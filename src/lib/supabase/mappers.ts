import type {
  BusinessPublicDTO,
  CustomerDTO,
  InvoiceDTO,
  InvoiceItemDTO,
  InvoiceSendLogDTO,
  PaymentDTO,
  PublicInvoiceDTO,
} from "../types";
import { getDisplayInvoiceStatus, type StoredInvoiceStatus } from "../dates";

export interface BusinessRow {
  id: string;
  owner_user_id: string;
  name: string;
  logo_data_url: string | null;
  address: string;
  gstin: string;
  phone: string;
  contact_email: string;
  invoice_prefix: string;
  next_invoice_number: number;
  invoice_number_padding: number;
  default_gst_rate: number | string;
  default_due_days: number;
  default_notes: string;
  default_terms: string;
  razorpay_key_id: string | null;
  razorpay_key_secret_enc: string | null;
  razorpay_webhook_secret_enc: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_email: string | null;
  smtp_password_enc: string | null;
  email_subject_template: string;
  email_body_template: string;
}

export interface CustomerRow {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email: string;
  created_at: string;
}

export interface InvoiceRow {
  id: string;
  business_id: string;
  customer_id: string;
  invoice_number: string;
  public_token: string;
  status: StoredInvoiceStatus;
  issue_date: string;
  due_date: string;
  gst_rate: number | string;
  subtotal_paise: number | string;
  gst_paise: number | string;
  total_paise: number | string;
  business_name_snapshot: string;
  business_logo_snapshot: string | null;
  business_address_snapshot: string;
  business_gstin_snapshot: string;
  business_phone_snapshot: string;
  business_email_snapshot: string;
  notes_snapshot: string;
  terms_snapshot: string;
  customer_name_snapshot: string;
  customer_email_snapshot: string;
  customer_phone_snapshot: string;
  sent_at: string | null;
  paid_at: string | null;
  reminder_sent_at: string | null;
  razorpay_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number | string;
  unit_price_paise: number | string;
  line_total_paise: number | string;
}

export interface InvoiceSendLogRow {
  id: string;
  recipient_email: string;
  subject: string;
  status: "sent" | "failed";
  error_message: string | null;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount_paise: number | string;
  currency: string;
  source: "checkout" | "webhook";
  created_at: string;
}

export function toBusinessPublicDTO(row: BusinessRow): BusinessPublicDTO {
  return {
    id: row.id,
    name: row.name,
    logoDataUrl: row.logo_data_url,
    address: row.address,
    gstin: row.gstin,
    phone: row.phone,
    contactEmail: row.contact_email,
    invoicePrefix: row.invoice_prefix,
    nextInvoiceNumber: row.next_invoice_number,
    invoiceNumberPadding: row.invoice_number_padding,
    defaultGstRate: Number(row.default_gst_rate),
    defaultDueDays: row.default_due_days,
    defaultNotes: row.default_notes,
    defaultTerms: row.default_terms,
    razorpayKeyId: row.razorpay_key_id,
    hasRazorpaySecret: Boolean(row.razorpay_key_secret_enc),
    hasRazorpayWebhookSecret: Boolean(row.razorpay_webhook_secret_enc),
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecure: row.smtp_secure,
    smtpEmail: row.smtp_email,
    hasSmtpPassword: Boolean(row.smtp_password_enc),
    emailSubjectTemplate: row.email_subject_template,
    emailBodyTemplate: row.email_body_template,
  };
}

export function toCustomerDTO(row: CustomerRow): CustomerDTO {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    createdAt: row.created_at,
  };
}

export function toInvoiceDTO(row: InvoiceRow, now: Date = new Date()): InvoiceDTO {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    invoiceNumber: row.invoice_number,
    publicToken: row.public_token,
    status: row.status,
    displayStatus: getDisplayInvoiceStatus(row.status, row.due_date, now),
    issueDate: row.issue_date,
    dueDate: row.due_date,
    gstRate: Number(row.gst_rate),
    subtotalPaise: Number(row.subtotal_paise),
    gstPaise: Number(row.gst_paise),
    totalPaise: Number(row.total_paise),
    businessNameSnapshot: row.business_name_snapshot,
    businessLogoSnapshot: row.business_logo_snapshot,
    businessAddressSnapshot: row.business_address_snapshot,
    businessGstinSnapshot: row.business_gstin_snapshot,
    businessPhoneSnapshot: row.business_phone_snapshot,
    businessEmailSnapshot: row.business_email_snapshot,
    notesSnapshot: row.notes_snapshot,
    termsSnapshot: row.terms_snapshot,
    customerNameSnapshot: row.customer_name_snapshot,
    customerEmailSnapshot: row.customer_email_snapshot,
    customerPhoneSnapshot: row.customer_phone_snapshot,
    sentAt: row.sent_at,
    paidAt: row.paid_at,
    reminderSentAt: row.reminder_sent_at,
    razorpayOrderId: row.razorpay_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toInvoiceItemDTO(row: InvoiceItemRow): InvoiceItemDTO {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPricePaise: Number(row.unit_price_paise),
    lineTotalPaise: Number(row.line_total_paise),
  };
}

export function toInvoiceSendLogDTO(row: InvoiceSendLogRow): InvoiceSendLogDTO {
  return {
    id: row.id,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export function toPaymentDTO(row: PaymentRow): PaymentDTO {
  return {
    id: row.id,
    razorpayOrderId: row.razorpay_order_id,
    razorpayPaymentId: row.razorpay_payment_id,
    amountPaise: Number(row.amount_paise),
    currency: row.currency,
    source: row.source,
    createdAt: row.created_at,
  };
}

export function toPublicInvoiceDTO(
  invoice: InvoiceRow,
  items: InvoiceItemRow[],
  razorpayConnected: boolean,
  now: Date = new Date()
): PublicInvoiceDTO {
  return {
    publicToken: invoice.public_token,
    invoiceNumber: invoice.invoice_number,
    status: invoice.status,
    displayStatus: getDisplayInvoiceStatus(invoice.status, invoice.due_date, now),
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
    notes: invoice.notes_snapshot,
    terms: invoice.terms_snapshot,
    customerName: invoice.customer_name_snapshot,
    customerEmail: invoice.customer_email_snapshot,
    customerPhone: invoice.customer_phone_snapshot,
    paidAt: invoice.paid_at,
    razorpayConnected,
    items: items.map(toInvoiceItemDTO),
  };
}
