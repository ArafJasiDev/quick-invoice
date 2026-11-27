import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { addDaysToDateString, formatDisplayDate, getDateStringIST } from "@/lib/dates";
import { formatSmtpError, sendBusinessEmail } from "@/lib/email";
import { buildPdfDataFromInvoice, getRequestOrigin } from "@/lib/invoice-service";
import { formatINR } from "@/lib/money";
import { generateInvoicePdf } from "@/lib/pdf";
import type { BusinessRow, InvoiceItemRow, InvoiceRow } from "@/lib/supabase/mappers";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Bonus: Sends an automatic reminder email to the customer the day before the due date
 * if the invoice is Sent and still unpaid, and marks reminder_sent_at so it sends at most once.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const authHeader = request.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const admin = createSupabaseAdminClient();
    const todayIST = getDateStringIST();
    const tomorrowIST = addDaysToDateString(todayIST, 1);

    const { data: dueTomorrow, error } = await admin
      .from("invoices")
      .select("*")
      .eq("status", "sent")
      .eq("due_date", tomorrowIST)
      .is("reminder_sent_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const invoices = (dueTomorrow ?? []) as InvoiceRow[];
    const origin = getRequestOrigin(request);
    let sentCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const invoice of invoices) {
      const { data: bizData } = await admin
        .from("businesses")
        .select("*")
        .eq("id", invoice.business_id)
        .single();

      const biz = bizData as BusinessRow | null;
      if (!biz?.smtp_email || !biz.smtp_password_enc) {
        skippedCount += 1;
        continue;
      }

      try {
        const { data: itemsData } = await admin
          .from("invoice_items")
          .select("*")
          .eq("invoice_id", invoice.id)
          .order("sort_order", { ascending: true });

        const password = decryptSecret(biz.smtp_password_enc);
        const paymentLink = `${origin}/i/${invoice.public_token}`;
        const amountStr = formatINR(Number(invoice.total_paise));
        const dueDateStr = formatDisplayDate(invoice.due_date);

        const subject = `Reminder: Invoice ${invoice.invoice_number} due tomorrow (${dueDateStr})`;
        const text =
          `Hi ${invoice.customer_name_snapshot},\n\n` +
          `This is a friendly reminder that invoice ${invoice.invoice_number} for ${amountStr} from ${invoice.business_name_snapshot} is due tomorrow (${dueDateStr}).\n\n` +
          `View and pay your invoice here:\n${paymentLink}\n\n` +
          `Thank you!`;

        const pdfBuffer = await generateInvoicePdf(
          buildPdfDataFromInvoice(invoice, (itemsData ?? []) as InvoiceItemRow[])
        );

        await sendBusinessEmail({
          smtp: {
            host: biz.smtp_host,
            port: biz.smtp_port,
            secure: biz.smtp_secure,
            email: biz.smtp_email,
            password,
          },
          fromName: invoice.business_name_snapshot,
          to: invoice.customer_email_snapshot,
          subject,
          text,
          attachment: {
            filename: `${invoice.invoice_number.replaceAll(/[^a-zA-Z0-9._-]/g, "_")}.pdf`,
            content: pdfBuffer,
          },
        });

        await Promise.all([
          admin
            .from("invoices")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", invoice.id),
          admin.from("invoice_send_logs").insert({
            invoice_id: invoice.id,
            business_id: invoice.business_id,
            recipient_email: invoice.customer_email_snapshot,
            subject,
            status: "sent",
            error_message: null,
          }),
        ]);
        sentCount += 1;
      } catch (err) {
        const msg = formatSmtpError(err);
        errors.push(`${invoice.invoice_number}: ${msg}`);
        await admin.from("invoice_send_logs").insert({
          invoice_id: invoice.id,
          business_id: invoice.business_id,
          recipient_email: invoice.customer_email_snapshot,
          subject: `Reminder: Invoice ${invoice.invoice_number}`,
          status: "failed",
          error_message: msg,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      targetDueDate: tomorrowIST,
      matched: invoices.length,
      sent: sentCount,
      skippedNoEmailConfig: skippedCount,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reminder job failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
