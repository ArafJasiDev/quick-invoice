"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Mail,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { InvoiceEditorForm } from "@/components/InvoiceEditorForm";
import {
  Alert,
  Card,
  Spinner,
  StatusBadge,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui";
import { formatDisplayDate, formatDisplayDateTimeIST } from "@/lib/dates";
import { formatINR, paiseToDecimalString } from "@/lib/money";
import type { CustomerDTO, InvoiceDetailDTO } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const invoiceId = params.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceDetailDTO | null>(null);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);

  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});

  const [sending, setSending] = useState(false);
  const [actionAlert, setActionAlert] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [origin, setOrigin] = useState("");

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [invRes, custRes] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`, { cache: "no-store" }),
        fetch("/api/customers", { cache: "no-store" }),
      ]);
      const invJson = (await invRes.json()) as {
        invoice?: InvoiceDetailDTO;
        error?: string;
      };
      const custJson = (await custRes.json()) as { customers?: CustomerDTO[] };

      if (!invRes.ok || !invJson.invoice) {
        throw new Error(invJson.error ?? "Invoice not found.");
      }

      setInvoice(invJson.invoice);
      setCustomers(custJson.customers ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load invoice.");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadInvoice();
  }, [loadInvoice]);

  const handleSendInvoice = async () => {
    if (!invoice) return;
    setSending(true);
    setActionAlert(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        invoice?: InvoiceDetailDTO;
      };

      if (json.invoice) {
        setInvoice(json.invoice);
      }

      if (!res.ok || !json.ok) {
        setActionAlert({
          variant: "error",
          message: json.error ?? "Could not send invoice email.",
        });
        return;
      }

      setActionAlert({
        variant: "success",
        message: json.message ?? "Invoice emailed with PDF attached.",
      });
    } catch (err) {
      setActionAlert({
        variant: "error",
        message: err instanceof Error ? err.message : "Failed to send invoice.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!invoice || invoice.status !== "draft") return;
    const res = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      setActionAlert({
        variant: "error",
        message: json.error ?? "Could not delete draft.",
      });
      return;
    }
    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading invoice..." />
      </div>
    );
  }

  if (loadError || !invoice) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Dashboard</span>
        </Link>
        <Alert variant="error" title="Could not open invoice">
          {loadError ?? "Invoice not found."}
        </Alert>
      </div>
    );
  }

  const publicUrl = origin ? `${origin}/i/${invoice.publicToken}` : `/i/${invoice.publicToken}`;

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {invoice.invoiceNumber}
              </h1>
              <StatusBadge status={invoice.displayStatus} />
            </div>
            <p className="text-xs text-slate-500">
              {invoice.customerNameSnapshot} • Due {formatDisplayDate(invoice.dueDate)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            className={secondaryButtonClassName}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download PDF</span>
          </a>

          {invoice.status === "draft" && !editing ? (
            <button
              type="button"
              onClick={() => {
                setEditError(null);
                setEditFieldErrors({});
                setEditing(true);
              }}
              className={secondaryButtonClassName}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              <span>Edit Draft</span>
            </button>
          ) : null}

          {invoice.status !== "paid" ? (
            <button
              type="button"
              disabled={sending}
              onClick={() => void handleSendInvoice()}
              className={primaryButtonClassName}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              <span>
                {sending
                  ? "Sending..."
                  : invoice.status === "draft"
                    ? "Send Invoice"
                    : "Resend Email"}
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {actionAlert ? (
        <Alert variant={actionAlert.variant}>{actionAlert.message}</Alert>
      ) : null}

      {/* Public link bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Customer Public Link
            </p>
            <p className="truncate text-sm text-slate-700">{publicUrl}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(publicUrl);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className={secondaryButtonClassName}
            >
              {copiedLink ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  <span>Copy link</span>
                </>
              )}
            </button>
            <Link
              href={`/i/${invoice.publicToken}`}
              target="_blank"
              className={secondaryButtonClassName}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span>Open public view</span>
            </Link>
          </div>
        </div>
      </Card>

      {editing && invoice.status === "draft" ? (
        <InvoiceEditorForm
          customers={customers}
          defaultDueDays={15}
          initialData={{
            customerId: invoice.customerId,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            gstRate: String(invoice.gstRate),
            notes: invoice.notesSnapshot,
            terms: invoice.termsSnapshot,
            items: invoice.items.map((item) => ({
              description: item.description,
              quantity: String(item.quantity),
              unitPrice: paiseToDecimalString(item.unitPricePaise),
            })),
          }}
          submitLabel="Save Draft Changes"
          submitting={savingEdit}
          serverError={editError}
          serverFieldErrors={editFieldErrors}
          onCancel={() => setEditing(false)}
          onSubmit={async (payload) => {
            setSavingEdit(true);
            setEditError(null);
            setEditFieldErrors({});
            try {
              const res = await fetch(`/api/invoices/${invoice.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = (await res.json()) as {
                invoice?: InvoiceDetailDTO;
                error?: string;
                fieldErrors?: FieldErrors;
              };
              if (!res.ok || !json.invoice) {
                if (json.fieldErrors) setEditFieldErrors(json.fieldErrors);
                throw new Error(json.error ?? "Could not update draft.");
              }
              setInvoice(json.invoice);
              setEditing(false);
              setActionAlert({ variant: "success", message: "Draft invoice updated." });
            } catch (err) {
              setEditError(err instanceof Error ? err.message : "Could not update draft.");
            } finally {
              setSavingEdit(false);
            }
          }}
        />
      ) : (
        /* Invoice document preview (mirrors PDF) */
        <Card className="p-5 sm:p-8">
          <div className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 sm:flex-row">
            <div className="space-y-2">
              {invoice.businessLogoSnapshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={invoice.businessLogoSnapshot}
                  alt={`${invoice.businessNameSnapshot} logo`}
                  className="h-12 w-auto object-contain"
                />
              ) : null}
              <h2 className="text-lg font-bold text-slate-900">
                {invoice.businessNameSnapshot}
              </h2>
              <div className="space-y-0.5 text-sm text-slate-600">
                {invoice.businessAddressSnapshot ? (
                  <p className="whitespace-pre-line">{invoice.businessAddressSnapshot}</p>
                ) : null}
                {invoice.businessGstinSnapshot ? (
                  <p>GSTIN: {invoice.businessGstinSnapshot}</p>
                ) : null}
                {invoice.businessPhoneSnapshot ? (
                  <p>Phone: {invoice.businessPhoneSnapshot}</p>
                ) : null}
                {invoice.businessEmailSnapshot ? (
                  <p>Email: {invoice.businessEmailSnapshot}</p>
                ) : null}
              </div>
            </div>

            <div className="sm:text-right">
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Invoice
              </p>
              <p className="text-xl font-bold text-slate-900">{invoice.invoiceNumber}</p>
              {invoice.status === "paid" ? (
                <div className="mt-2 inline-block rounded-lg border-2 border-emerald-600 bg-emerald-50 px-3 py-1 text-xs font-extrabold tracking-widest text-emerald-700">
                  PAID
                </div>
              ) : null}
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <p>Invoice Date: {formatDisplayDate(invoice.issueDate)}</p>
                <p className="font-semibold text-slate-900">
                  Due Date: {formatDisplayDate(invoice.dueDate)}
                </p>
              </div>
            </div>
          </div>

          <div className="py-6">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Bill To
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {invoice.customerNameSnapshot}
            </p>
            <p className="text-sm text-slate-600">{invoice.customerEmailSnapshot}</p>
            {invoice.customerPhoneSnapshot ? (
              <p className="text-sm text-slate-600">{invoice.customerPhoneSnapshot}</p>
            ) : null}
          </div>

          {/* Items */}
          <div tabIndex={0} role="region" aria-label="Invoice items" className="qi-table-wrap">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                  <th className="px-3 py-2.5">Description</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Rate</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 text-slate-900">{item.description}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{item.quantity}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap text-slate-600">
                      {formatINR(item.unitPricePaise)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold whitespace-nowrap text-slate-900">
                      {formatINR(item.lineTotalPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <dl className="w-full space-y-2 text-sm sm:max-w-xs">
              <div className="flex justify-between text-slate-600">
                <dt>Subtotal</dt>
                <dd className="font-medium text-slate-900">
                  {formatINR(invoice.subtotalPaise)}
                </dd>
              </div>
              <div className="flex justify-between text-slate-600">
                <dt>GST ({invoice.gstRate}%)</dt>
                <dd className="font-medium text-slate-900">{formatINR(invoice.gstPaise)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                <dt>Total</dt>
                <dd>{formatINR(invoice.totalPaise)}</dd>
              </div>
            </dl>
          </div>

          {(invoice.notesSnapshot || invoice.termsSnapshot) ? (
            <div className="mt-8 grid gap-6 border-t border-slate-200 pt-6 sm:grid-cols-2">
              {invoice.notesSnapshot ? (
                <div>
                  <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Notes
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                    {invoice.notesSnapshot}
                  </p>
                </div>
              ) : null}
              {invoice.termsSnapshot ? (
                <div>
                  <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Terms &amp; Conditions
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                    {invoice.termsSnapshot}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      )}

      {/* Send History & Payments */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-slate-900">Email Send History</h3>
          {invoice.sendLogs.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Not emailed yet. Click &ldquo;Send Invoice&rdquo; above to email the customer with the
              PDF and payment link.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {invoice.sendLogs.map((log) => (
                <li key={log.id} className="py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {log.status === "sent" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                      )}
                      <span className="font-medium text-slate-900">
                        {log.status === "sent" ? "Sent" : "Failed"} to {log.recipientEmail}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatDisplayDateTimeIST(log.createdAt)}
                    </span>
                  </div>
                  {log.errorMessage ? (
                    <p className="mt-1 pl-6 text-xs text-rose-700">{log.errorMessage}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-slate-900">Payments</h3>
          {invoice.payments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No online payments recorded yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {invoice.payments.map((pay) => (
                <li key={pay.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-emerald-700">
                      {formatINR(pay.amountPaise)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDisplayDateTimeIST(pay.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Payment ID: <code>{pay.razorpayPaymentId}</code> ({pay.source})
                  </p>
                </li>
              ))}
            </ul>
          )}

          {invoice.status === "draft" ? (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => void handleDeleteDraft()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Delete this draft invoice</span>
              </button>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
