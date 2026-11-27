import { NextResponse } from "next/server";
import { decryptSecret, verifyRazorpayWebhookSignature } from "@/lib/crypto";
import type { BusinessRow, InvoiceRow } from "@/lib/supabase/mappers";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

interface RazorpayWebhookPayload {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string | null;
        amount?: number;
        currency?: string;
        status?: string;
        notes?: Record<string, string>;
      };
    };
    order?: {
      entity?: {
        id?: string;
        notes?: Record<string, string>;
      };
    };
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await context.params;
    const signature = request.headers.get("x-razorpay-signature") ?? "";
    const rawBody = await request.text();

    const admin = createSupabaseAdminClient();
    const { data: bizData, error: bizErr } = await admin
      .from("businesses")
      .select("id,razorpay_webhook_secret_enc")
      .eq("id", businessId)
      .maybeSingle();

    if (bizErr) {
      return NextResponse.json({ error: bizErr.message }, { status: 500 });
    }
    if (!bizData) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const biz = bizData as Pick<BusinessRow, "id" | "razorpay_webhook_secret_enc">;
    if (!biz.razorpay_webhook_secret_enc) {
      return NextResponse.json(
        { error: "Webhook secret is not configured for this business." },
        { status: 400 }
      );
    }

    const webhookSecret = decryptSecret(biz.razorpay_webhook_secret_enc);
    const valid = verifyRazorpayWebhookSignature({
      rawBody,
      signature,
      webhookSecret,
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    const eventBody = JSON.parse(rawBody) as RazorpayWebhookPayload;
    const eventName = eventBody.event ?? "";
    if (eventName !== "payment.captured" && eventName !== "order.paid") {
      return NextResponse.json({ ok: true, ignored: eventName });
    }

    const payment = eventBody.payload?.payment?.entity;
    const order = eventBody.payload?.order?.entity;
    if (!payment?.id || !payment.order_id) {
      return NextResponse.json({ ok: true, ignored: "missing_payment_or_order" });
    }

    const orderId = payment.order_id;
    const noteInvoiceId =
      payment.notes?.invoice_id ?? order?.notes?.invoice_id ?? null;

    let invoiceRow: InvoiceRow | null = null;
    if (noteInvoiceId) {
      const { data } = await admin
        .from("invoices")
        .select("*")
        .eq("id", noteInvoiceId)
        .eq("business_id", businessId)
        .maybeSingle();
      invoiceRow = (data as InvoiceRow | null) ?? null;
    }

    if (!invoiceRow) {
      const { data } = await admin
        .from("invoices")
        .select("*")
        .eq("razorpay_order_id", orderId)
        .eq("business_id", businessId)
        .maybeSingle();
      invoiceRow = (data as InvoiceRow | null) ?? null;
    }

    if (!invoiceRow) {
      return NextResponse.json({ ok: true, ignored: "invoice_not_found_for_business" });
    }

    const paidAmount = Number(payment.amount ?? 0);
    if (
      (payment.currency ?? "INR") !== "INR" ||
      paidAmount < Number(invoiceRow.total_paise)
    ) {
      return NextResponse.json(
        { error: "Webhook payment amount does not cover invoice total." },
        { status: 400 }
      );
    }

    const { error: recErr } = await admin.rpc("record_razorpay_payment", {
      p_invoice_id: invoiceRow.id,
      p_razorpay_order_id: orderId,
      p_razorpay_payment_id: payment.id,
      p_amount_paise: paidAmount,
      p_currency: payment.currency ?? "INR",
      p_source: "webhook",
      p_raw_payload: eventBody,
    });

    if (recErr) {
      return NextResponse.json({ error: recErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook processing error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
