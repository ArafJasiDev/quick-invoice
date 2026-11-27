import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { formatDisplayDate } from "@/lib/dates";
import { formatSmtpError, sendBusinessEmail } from "@/lib/email";
import { renderEmailTemplate } from "@/lib/email-template";
import {
  buildPdfDataFromInvoice,
  fetchInvoiceDetailForBusiness,
  getRequestOrigin,
} from "@/lib/invoice-service";
import { formatINR } from "@/lib/money";
import { generateInvoicePdf } from "@/lib/pdf";
import type { InvoiceItemRow, InvoiceRow } from "@/lib/supabase/mappers";
import { getAuthenticatedBusiness } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (!auth) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }
    const { id } = await context.params;

    const { data: invData, error: invErr } = await auth.supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("business_id", auth.business.id)
      .maybeSingle();

    if (invErr) {
      return NextResponse.json({ error: invErr.message }, { status: 500 });
    }
    if (!invData) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    const invoiceRow = invData as InvoiceRow;

    if (!auth.business.smtp_email || !auth.business.smtp_password_enc) {
      return NextResponse.json(
        {
          error:
            "Email sending is not set up yet. Connect your email account in Settings → Email first.",
        },
        { status: 400 }
      );
    }

    const { data: itemsData, error: itemsErr } = await auth.supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .eq("business_id", auth.business.id)
      .order("sort_order", { ascending: true });

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    const origin = getRequestOrigin(request);
    const paymentLink = `${origin}/i/${invoiceRow.public_token}`;
    const templateVars = {
      customerName: invoiceRow.customer_name_snapshot,
      invoiceNumber: invoiceRow.invoice_number,
      amount: formatINR(Number(invoiceRow.total_paise)),
      dueDate: formatDisplayDate(invoiceRow.due_date),
      paymentLink,
      businessName: invoiceRow.business_name_snapshot,
    };

    const subject = renderEmailTemplate(auth.business.email_subject_template, templateVars);
    const text = renderEmailTemplate(auth.business.email_body_template, templateVars);

    const smtpPassword = decryptSecret(auth.business.smtp_password_enc);

    // Prepare PDF matching the invoice state (if draft, it will show Sent once sent)
    const effectiveInvoiceForPdf: InvoiceRow =
      invoiceRow.status === "draft"
        ? { ...invoiceRow, status: "sent" }
        : invoiceRow;

    const pdfBuffer = await generateInvoicePdf(
      buildPdfDataFromInvoice(effectiveInvoiceForPdf, (itemsData ?? []) as InvoiceItemRow[])
    );
    const safeFileName = invoiceRow.invoice_number.replaceAll(/[^a-zA-Z0-9._-]/g, "_");

    try {
      await sendBusinessEmail({
        smtp: {
          host: auth.business.smtp_host,
          port: auth.business.smtp_port,
          secure: auth.business.smtp_secure,
          email: auth.business.smtp_email,
          password: smtpPassword,
        },
        fromName: invoiceRow.business_name_snapshot,
        to: invoiceRow.customer_email_snapshot,
        subject,
        text,
        attachment: {
          filename: `${safeFileName}.pdf`,
          content: pdfBuffer,
        },
      });
    } catch (sendErr) {
      const reason = formatSmtpError(sendErr);
      await auth.supabase.from("invoice_send_logs").insert({
        invoice_id: invoiceRow.id,
        business_id: auth.business.id,
        recipient_email: invoiceRow.customer_email_snapshot,
        subject,
        status: "failed",
        error_message: reason,
      });

      const updatedDetail = await fetchInvoiceDetailForBusiness(
        auth.supabase,
        auth.business.id,
        id
      );

      return NextResponse.json(
        {
          ok: false,
          error: reason,
          invoice: updatedDetail,
        },
        { status: 502 }
      );
    }

    // Email succeeded -> log & move Draft to Sent
    await auth.supabase.from("invoice_send_logs").insert({
      invoice_id: invoiceRow.id,
      business_id: auth.business.id,
      recipient_email: invoiceRow.customer_email_snapshot,
      subject,
      status: "sent",
      error_message: null,
    });

    if (invoiceRow.status === "draft") {
      await auth.supabase
        .from("invoices")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", invoiceRow.id)
        .eq("business_id", auth.business.id);
    }

    const updatedDetail = await fetchInvoiceDetailForBusiness(
      auth.supabase,
      auth.business.id,
      id
    );

    return NextResponse.json({
      ok: true,
      message: `Invoice emailed to ${invoiceRow.customer_email_snapshot}.`,
      invoice: updatedDetail,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send invoice.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
