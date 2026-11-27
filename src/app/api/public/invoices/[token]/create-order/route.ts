import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { createRazorpayOrder } from "@/lib/razorpay";
import type { BusinessRow, InvoiceRow } from "@/lib/supabase/mappers";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const admin = createSupabaseAdminClient();

    const { data: invData, error: invError } = await admin
      .from("invoices")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();

    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 500 });
    }
    if (!invData) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    const invoice = invData as InvoiceRow;
    if (invoice.status === "paid") {
      return NextResponse.json(
        { error: "This invoice has already been paid." },
        { status: 409 }
      );
    }

    const amountPaise = Number(invoice.total_paise);
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      return NextResponse.json(
        { error: "Invoice total must be greater than ₹0.00 to pay online." },
        { status: 400 }
      );
    }

    const { data: bizData, error: bizError } = await admin
      .from("businesses")
      .select("id,name,razorpay_key_id,razorpay_key_secret_enc")
      .eq("id", invoice.business_id)
      .single();

    if (bizError || !bizData) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const biz = bizData as Pick<
      BusinessRow,
      "id" | "name" | "razorpay_key_id" | "razorpay_key_secret_enc"
    >;

    if (!biz.razorpay_key_id || !biz.razorpay_key_secret_enc) {
      return NextResponse.json(
        { error: "Online payments are not enabled for this business." },
        { status: 400 }
      );
    }

    const keySecret = decryptSecret(biz.razorpay_key_secret_enc);
    const order = await createRazorpayOrder({
      keyId: biz.razorpay_key_id,
      keySecret,
      amountPaise,
      receipt: invoice.invoice_number,
      notes: {
        invoice_id: invoice.id,
        business_id: biz.id,
        invoice_number: invoice.invoice_number,
      },
    });

    await admin
      .from("invoices")
      .update({ razorpay_order_id: order.id })
      .eq("id", invoice.id);

    return NextResponse.json({
      orderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      keyId: biz.razorpay_key_id,
      businessName: invoice.business_name_snapshot,
      invoiceNumber: invoice.invoice_number,
      customerName: invoice.customer_name_snapshot,
      customerEmail: invoice.customer_email_snapshot,
      customerPhone: invoice.customer_phone_snapshot,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start payment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
