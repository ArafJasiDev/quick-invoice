"use client";

import Script from "next/script";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CreditCard, Download } from "lucide-react";
import {
  Alert,
  Card,
  Spinner,
  StatusBadge,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui";
import { formatDisplayDate, formatDisplayDateTimeIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { PublicInvoiceDTO } from "@/lib/types";

interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export default function PublicInvoicePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<PublicInvoiceDTO | null>(null);

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payStatus, setPayStatus] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/public/invoices/${token}`, { cache: "no-store" });
      const json = (await res.json()) as { invoice?: PublicInvoiceDTO; error?: string };
      if (!res.ok || !json.invoice) {
        throw new Error(json.error ?? "Invoice not found.");
      }
      setInvoice(json.invoice);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load invoice.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  const handlePayNow = async () => {
    if (!invoice || invoice.status === "paid") return;
    setPaying(true);
    setPayStatus(null);

    try {
      const res = await fetch(`/api/public/invoices/${token}/create-order`, {
        method: "POST",
      });
      const orderJson = (await res.json()) as {
        orderId?: string;
        amountPaise?: number;
        currency?: string;
        keyId?: string;
        businessName?: string;
        invoiceNumber?: string;
        customerName?: string;
        customerEmail?: string;
        customerPhone?: string;
        error?: string;
      };

      if (!res.ok || !orderJson.orderId || !orderJson.keyId) {
        throw new Error(orderJson.error ?? "Could not start payment.");
      }

      if (!window.Razorpay) {
        throw new Error("Razorpay Checkout is still loading. Wait a second and try again.");
      }

      const rzp = new window.Razorpay({
        key: orderJson.keyId,
        amount: orderJson.amountPaise,
        currency: orderJson.currency ?? "INR",
        name: orderJson.businessName ?? invoice.businessName,
        description: `Invoice ${orderJson.invoiceNumber ?? invoice.invoiceNumber}`,
        order_id: orderJson.orderId,
        prefill: {
          name: orderJson.customerName ?? invoice.customerName,
          email: orderJson.customerEmail ?? invoice.customerEmail,
          contact: orderJson.customerPhone ?? invoice.customerPhone,
        },
        theme: { color: "#1d4ed8" },
        handler: async (response: RazorpayHandlerResponse) => {
          try {
            const verifyRes = await fetch(`/api/public/invoices/${token}/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyJson = (await verifyRes.json()) as {
              ok?: boolean;
              error?: string;
            };
            if (!verifyRes.ok || !verifyJson.ok) {
              setPayStatus({
                variant: "error",
                message:
                  verifyJson.error ??
                  "Payment could not be verified automatically. Refresh the page in a few seconds.",
              });
            } else {
              setPayStatus({
                variant: "success",
                message: "Payment received! Thank you — your invoice is now marked Paid.",
              });
              await loadInvoice();
            }
          } catch {
            setPayStatus({
              variant: "error",
              message: "Network error while confirming payment. Please refresh the page.",
            });
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
          },
        },
      });

      rzp.on("payment.failed", (resp) => {
        setPaying(false);
        setPayStatus({
          variant: "error",
          message: resp.error?.description ?? "Payment failed. Please try again.",
        });
      });

      rzp.open();
    } catch (err) {
      setPaying(false);
      setPayStatus({
        variant: "error",
        message: err instanceof Error ? err.message : "Could not start payment.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <Spinner label="Loading invoice..." />
      </div>
    );
  }

  if (loadError || !invoice) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md">
          <Alert variant="error" title="Invoice unavailable">
            {loadError ?? "This invoice link is invalid or no longer available."}
          </Alert>
        </div>
      </div>
    );
  }

  const showPayButton =
    invoice.razorpayConnected &&
    invoice.status !== "paid" &&
    invoice.totalPaise > 0;

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="mx-auto max-w-3xl space-y-5">
        {/* Top action bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {invoice.businessLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={invoice.businessLogo}
                alt={`${invoice.businessName} logo`}
                className="h-10 w-auto rounded-lg object-contain"
              />
            ) : null}
            <div>
              <p className="text-base font-bold text-slate-900">{invoice.businessName}</p>
              <p className="text-xs text-slate-500">Invoice {invoice.invoiceNumber}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <a
              href={`/api/public/invoices/${invoice.publicToken}/pdf`}
              className={secondaryButtonClassName}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download PDF</span>
            </a>

            {showPayButton ? (
              <button
                type="button"
                disabled={paying || !scriptLoaded}
                onClick={() => void handlePayNow()}
                className={primaryButtonClassName}
              >
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                <span>
                  {paying ? "Opening Razorpay..." : `Pay ${formatINR(invoice.totalPaise)}`}
                </span>
              </button>
            ) : null}
          </div>
        </div>

        {payStatus ? (
          <Alert variant={payStatus.variant}>{payStatus.message}</Alert>
        ) : null}

        {invoice.status === "paid" ? (
          <Alert variant="success" title="Invoice Paid">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Paid in full ({formatINR(invoice.totalPaise)})
                {invoice.paidAt ? ` on ${formatDisplayDateTimeIST(invoice.paidAt)}` : ""}.
              </span>
            </div>
          </Alert>
        ) : null}

        <Card className="p-5 sm:p-8">
          <div className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 sm:flex-row">
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-slate-900">{invoice.businessName}</h1>
              <div className="space-y-0.5 text-sm text-slate-600">
                {invoice.businessAddress ? (
                  <p className="whitespace-pre-line">{invoice.businessAddress}</p>
                ) : null}
                {invoice.businessGstin ? <p>GSTIN: {invoice.businessGstin}</p> : null}
                {invoice.businessPhone ? <p>Phone: {invoice.businessPhone}</p> : null}
                {invoice.businessEmail ? <p>Email: {invoice.businessEmail}</p> : null}
              </div>
            </div>

            <div className="sm:text-right">
              <div className="flex items-center gap-2 sm:justify-end">
                <span className="text-lg font-bold text-slate-900">{invoice.invoiceNumber}</span>
                <StatusBadge status={invoice.displayStatus} />
              </div>
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
            <p className="mt-1 text-base font-semibold text-slate-900">{invoice.customerName}</p>
            <p className="text-sm text-slate-600">{invoice.customerEmail}</p>
            {invoice.customerPhone ? (
              <p className="text-sm text-slate-600">{invoice.customerPhone}</p>
            ) : null}
          </div>

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
                <dd className="font-medium text-slate-900">{formatINR(invoice.subtotalPaise)}</dd>
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

          {(invoice.notes || invoice.terms) ? (
            <div className="mt-8 grid gap-6 border-t border-slate-200 pt-6 sm:grid-cols-2">
              {invoice.notes ? (
                <div>
                  <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Notes
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{invoice.notes}</p>
                </div>
              ) : null}
              {invoice.terms ? (
                <div>
                  <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Terms &amp; Conditions
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{invoice.terms}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
