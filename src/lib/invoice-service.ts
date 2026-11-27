import type { SupabaseClient } from "@supabase/supabase-js";
import { getDisplayInvoiceStatus } from "./dates";
import type { PdfInvoiceData } from "./pdf";
import {
  toInvoiceDTO,
  toInvoiceItemDTO,
  toInvoiceSendLogDTO,
  toPaymentDTO,
  type InvoiceItemRow,
  type InvoiceRow,
  type InvoiceSendLogRow,
  type PaymentRow,
} from "./supabase/mappers";
import type { InvoiceDetailDTO } from "./types";

export async function fetchInvoiceDetailForBusiness(
  supabase: SupabaseClient,
  businessId: string,
  invoiceId: string
): Promise<InvoiceDetailDTO | null> {
  const { data: invoiceData, error: invError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (invError) {
    throw new Error(invError.message);
  }
  if (!invoiceData) return null;

  const [itemsRes, logsRes, paymentsRes] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("invoice_send_logs")
      .select("*")
      .eq("invoice_id", invoiceId)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (logsRes.error) throw new Error(logsRes.error.message);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);

  const invoiceRow = invoiceData as InvoiceRow;
  return {
    ...toInvoiceDTO(invoiceRow),
    items: ((itemsRes.data ?? []) as InvoiceItemRow[]).map(toInvoiceItemDTO),
    sendLogs: ((logsRes.data ?? []) as InvoiceSendLogRow[]).map(toInvoiceSendLogDTO),
    payments: ((paymentsRes.data ?? []) as PaymentRow[]).map(toPaymentDTO),
  };
}

export function buildPdfDataFromInvoice(
  invoice: InvoiceRow,
  items: InvoiceItemRow[]
): PdfInvoiceData {
  return {
    invoiceNumber: invoice.invoice_number,
    status: getDisplayInvoiceStatus(invoice.status, invoice.due_date),
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    gstRate: Number(invoice.gst_rate),
    subtotalPaise: Number(invoice.subtotal_paise),
    gstPaise: Number(invoice.gst_paise),
    totalPaise: Number(invoice.total_paise),
    businessName: invoice.business_name_snapshot,
    businessLogo: invoice.business_logo_snapshot,
    businessAddress: invoice.business_address_snapshot,
    businessGstin: invoice.business_gstin_snapshot,
    businessPhone: invoice.business_phone_snapshot,
    businessEmail: invoice.business_email_snapshot,
    customerName: invoice.customer_name_snapshot,
    customerEmail: invoice.customer_email_snapshot,
    customerPhone: invoice.customer_phone_snapshot,
    notes: invoice.notes_snapshot,
    terms: invoice.terms_snapshot,
    items: items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPricePaise: Number(item.unit_price_paise),
      lineTotalPaise: Number(item.line_total_paise),
    })),
  };
}

export function getRequestOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) {
    const scheme = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : proto;
    return `${scheme}://${host}`;
  }
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return new URL(request.url).origin;
}
