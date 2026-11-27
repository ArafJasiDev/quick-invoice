import { NextResponse } from "next/server";
import { decryptSecret, verifyRazorpayCheckoutSignature } from "@/lib/crypto";
import { fetchRazorpayPayment } from "@/lib/razorpay";
import type { BusinessRow, InvoiceRow } from "@/lib/supabase/mappers";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    const orderId = (body.razorpay_order_id ?? "").trim();
    const paymentId = (body.razorpay_payment_id ?? "").trim();
    const signature = (body.razorpay_signature ?? "").trim();

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: "Missing Razorpay payment confirmation details." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: invData, error: invError } = await admin
      .from("invoices")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();

    if (invError || !invData) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }
    const invoice = invData as InvoiceRow;

    const { data: bizData, error: bizError } = await admin
      .from("businesses")
      .select("id,razorpay_key_id,razorpay_key_secret_enc")
      .eq("id", invoice.business_id)
      .single();

    if (bizError || !bizData) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }
    const biz = bizData as Pick<
      BusinessRow,
      "id" | "razorpay_key_id" | "razorpay_key_secret_enc"
    >;

    if (!biz.razorpay_key_id || !biz.razorpay_key_secret_enc) {
      return NextResponse.json(
        { error: "Razorpay is not configured for this business." },
        { status: 400 }
      );
    }

    const keySecret = decryptSecret(biz.razorpay_key_secret_enc);
    const sigValid = verifyRazorpayCheckoutSignature({
      orderId,
      paymentId,
      signature,
      keySecret,
    });

    if (!sigValid) {
      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400 }
      );
    }

    // Confirm directly with Razorpay API using this business's credentials
    const rzpPayment = await fetchRazorpayPayment({
      keyId: biz.razorpay_key_id,
      keySecret,
      paymentId,
    });

    if (rzpPayment.order_id !== orderId) {
      return NextResponse.json(
        { error: "Payment order mismatch." },
        { status: 400 }
      );
    }
    if (rzpPayment.currency !== "INR" || rzpPayment.amount < Number(invoice.total_paise)) {
      return NextResponse.json(
        { error: "Payment amount does not match invoice total." },
        { status: 400 }
      );
    }
    if (rzpPayment.status !== "captured" && rzpPayment.status !== "authorized") {
      return NextResponse.json(
        { error: `Payment is in "${rzpPayment.status}" state and not completed.` },
        { status: 400 }
      );
    }

    const { data: recData, error: recError } = await admin.rpc("record_razorpay_payment", {
      p_invoice_id: invoice.id,
      p_razorpay_order_id: orderId,
      p_razorpay_payment_id: paymentId,
      p_amount_paise: rzpPayment.amount,
      p_currency: rzpPayment.currency,
      p_source: "checkout",
      p_raw_payload: rzpPayment,
    });

    if (recError) {
      return NextResponse.json({ error: recError.message }, { status: 500 });
    }

    const recRow = Array.isArray(recData) ? recData[0] : recData;
    return NextResponse.json({
      ok: true,
      alreadyRecorded: Boolean(recRow?.already_recorded),
      status: "paid",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment verification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
