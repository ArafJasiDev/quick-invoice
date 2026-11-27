/**
 * Replaces supported invoice email placeholders in subject and body templates.
 */

export interface EmailTemplateVariables {
  customerName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  paymentLink: string;
  businessName: string;
}

export const SUPPORTED_EMAIL_PLACEHOLDERS = [
  "{customer_name}",
  "{invoice_number}",
  "{amount}",
  "{due_date}",
  "{payment_link}",
  "{business_name}",
] as const;

export function renderEmailTemplate(
  template: string,
  vars: EmailTemplateVariables
): string {
  const replacements: Record<string, string> = {
    "{customer_name}": vars.customerName,
    "{invoice_number}": vars.invoiceNumber,
    "{amount}": vars.amount,
    "{due_date}": vars.dueDate,
    "{payment_link}": vars.paymentLink,
    "{business_name}": vars.businessName,
  };

  return template.replace(
    /\{(customer_name|invoice_number|amount|due_date|payment_link|business_name)\}/g,
    (token) => replacements[token] ?? token
  );
}
