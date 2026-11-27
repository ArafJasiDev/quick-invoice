import type { DisplayInvoiceStatus, StoredInvoiceStatus } from "./dates";

export interface BusinessPublicDTO {
  id: string;
  name: string;
  logoDataUrl: string | null;
  address: string;
  gstin: string;
  phone: string;
  contactEmail: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  invoiceNumberPadding: number;
  defaultGstRate: number;
  defaultDueDays: number;
  defaultNotes: string;
  defaultTerms: string;
  razorpayKeyId: string | null;
  hasRazorpaySecret: boolean;
  hasRazorpayWebhookSecret: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpEmail: string | null;
  hasSmtpPassword: boolean;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
}

export interface CustomerDTO {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface InvoiceItemDTO {
  id: string;
  description: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface InvoiceSendLogDTO {
  id: string;
  recipientEmail: string;
  subject: string;
  status: "sent" | "failed";
  errorMessage: string | null;
  createdAt: string;
}

export interface PaymentDTO {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  currency: string;
  source: "checkout" | "webhook";
  createdAt: string;
}

export interface InvoiceDTO {
  id: string;
  businessId: string;
  customerId: string;
  invoiceNumber: string;
  publicToken: string;
  status: StoredInvoiceStatus;
  displayStatus: DisplayInvoiceStatus;
  issueDate: string;
  dueDate: string;
  gstRate: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  businessNameSnapshot: string;
  businessLogoSnapshot: string | null;
  businessAddressSnapshot: string;
  businessGstinSnapshot: string;
  businessPhoneSnapshot: string;
  businessEmailSnapshot: string;
  notesSnapshot: string;
  termsSnapshot: string;
  customerNameSnapshot: string;
  customerEmailSnapshot: string;
  customerPhoneSnapshot: string;
  sentAt: string | null;
  paidAt: string | null;
  reminderSentAt: string | null;
  razorpayOrderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDetailDTO extends InvoiceDTO {
  items: InvoiceItemDTO[];
  sendLogs: InvoiceSendLogDTO[];
  payments: PaymentDTO[];
}

export interface PublicInvoiceDTO {
  publicToken: string;
  invoiceNumber: string;
  status: StoredInvoiceStatus;
  displayStatus: DisplayInvoiceStatus;
  issueDate: string;
  dueDate: string;
  gstRate: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  businessName: string;
  businessLogo: string | null;
  businessAddress: string;
  businessGstin: string;
  businessPhone: string;
  businessEmail: string;
  notes: string;
  terms: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paidAt: string | null;
  razorpayConnected: boolean;
  items: InvoiceItemDTO[];
}
