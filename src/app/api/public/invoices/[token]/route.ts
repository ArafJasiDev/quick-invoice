import { NextResponse } from "next/server";
import {
  toPublicInvoiceDTO,
  type BusinessRow,
  type InvoiceItemRow,
  type InvoiceRow,
} from "@/lib/supabase/mappers";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const admin = createSupabaseAdminClient();

    const { data: invoice, error: invError } = await admin
      .from("invoices")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();

    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 500 });
    }
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    const invoiceRow = invoice as InvoiceRow;

    const [bizRes, itemsRes] = await Promise.all([
      admin
        .from("businesses")
        .select("razorpay_key_id,razorpay_key_secret_enc")
        .eq("id", invoiceRow.business_id)
        .single(),
      admin
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceRow.id)
        .order("sort_order", { ascending: true }),
    ]);

    if (bizRes.error || itemsRes.error) {
      return NextResponse.json(
        { error: bizRes.error?.message ?? itemsRes.error?.message ?? "Failed to load invoice." },
        { status: 500 }
      );
    }

    const biz = bizRes.data as Pick<BusinessRow, "razorpay_key_id" | "razorpay_key_secret_enc">;
    const razorpayConnected = Boolean(biz.razorpay_key_id && biz.razorpay_key_secret_enc);

    return NextResponse.json({
      invoice: toPublicInvoiceDTO(
        invoiceRow,
        (itemsRes.data ?? []) as InvoiceItemRow[],
        razorpayConnected
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load invoice.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
