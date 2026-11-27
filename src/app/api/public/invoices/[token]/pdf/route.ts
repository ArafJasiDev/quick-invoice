import { NextResponse } from "next/server";
import { buildPdfDataFromInvoice } from "@/lib/invoice-service";
import { generateInvoicePdf } from "@/lib/pdf";
import type { InvoiceItemRow, InvoiceRow } from "@/lib/supabase/mappers";
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
    const { data: items, error: itemsError } = await admin
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceRow.id)
      .order("sort_order", { ascending: true });

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const pdfBuffer = await generateInvoicePdf(
      buildPdfDataFromInvoice(invoiceRow, (items ?? []) as InvoiceItemRow[])
    );

    const safeFileName = invoiceRow.invoice_number.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
