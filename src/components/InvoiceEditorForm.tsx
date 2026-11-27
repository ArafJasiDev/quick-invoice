"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Alert,
  Card,
  Field,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui";
import { addDaysToDateString } from "@/lib/dates";
import { calculateInvoiceTotals, formatINR, parseRupeesToPaise } from "@/lib/money";
import type { CustomerDTO } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

export interface EditorLineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface InvoiceFormInitialData {
  customerId: string;
  issueDate: string;
  dueDate: string;
  gstRate: string;
  notes: string;
  terms: string;
  items: EditorLineItem[];
}

export function InvoiceEditorForm({
  customers,
  defaultDueDays,
  initialData,
  submitLabel,
  submitting,
  serverError,
  serverFieldErrors,
  onSubmit,
  onCancel,
}: {
  customers: CustomerDTO[];
  defaultDueDays: number;
  initialData: InvoiceFormInitialData;
  submitLabel: string;
  submitting: boolean;
  serverError: string | null;
  serverFieldErrors: FieldErrors;
  onSubmit: (payload: {
    customerId: string;
    issueDate: string;
    dueDate: string;
    gstRate: number;
    notes: string;
    terms: string;
    items: Array<{ description: string; quantity: number; unitPrice: string }>;
  }) => Promise<void>;
  onCancel?: () => void;
}) {
  const [customerId, setCustomerId] = useState(initialData.customerId);
  const [issueDate, setIssueDate] = useState(initialData.issueDate);
  const [dueDate, setDueDate] = useState(initialData.dueDate);
  const [dueDateTouched, setDueDateTouched] = useState(false);
  const [gstRate, setGstRate] = useState(initialData.gstRate);
  const [notes, setNotes] = useState(initialData.notes);
  const [terms, setTerms] = useState(initialData.terms);
  const [items, setItems] = useState<EditorLineItem[]>(
    initialData.items.length > 0
      ? initialData.items
      : [{ description: "", quantity: "1", unitPrice: "" }]
  );
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});

  const errors: FieldErrors = { ...serverFieldErrors, ...localErrors };

  const handleIssueDateChange = (nextIssue: string) => {
    setIssueDate(nextIssue);
    if (!dueDateTouched && /^\d{4}-\d{2}-\d{2}$/.test(nextIssue)) {
      setDueDate(addDaysToDateString(nextIssue, defaultDueDays));
    }
  };

  // Live preview calculation
  const previewValidItems = items
    .map((item) => {
      const qty = Number(item.quantity);
      const pricePaise = parseRupeesToPaise(item.unitPrice);
      if (!Number.isFinite(qty) || qty <= 0 || pricePaise === null) return null;
      return {
        description: item.description,
        quantity: Number(qty.toFixed(2)),
        unitPricePaise: pricePaise,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const gstNum = Number(gstRate);
  const safeGst = Number.isFinite(gstNum) && gstNum >= 0 && gstNum <= 100 ? gstNum : 0;
  const liveTotals = calculateInvoiceTotals(previewValidItems, safeGst);

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: FieldErrors = {};

    if (!customerId.trim()) {
      nextErrors.customerId = "Select a customer.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
      nextErrors.issueDate = "Enter a valid invoice date.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      nextErrors.dueDate = "Enter a valid due date.";
    } else if (dueDate < issueDate) {
      nextErrors.dueDate = "Due date cannot be before the invoice date.";
    }
    if (!Number.isFinite(gstNum) || gstNum < 0 || gstNum > 100) {
      nextErrors.gstRate = "Enter a GST rate between 0 and 100.";
    }

    const parsedPayloadItems: Array<{ description: string; quantity: number; unitPrice: string }> =
      [];
    items.forEach((item, idx) => {
      const desc = item.description.trim();
      const qty = Number(item.quantity);
      const pricePaise = parseRupeesToPaise(item.unitPrice);
      if (!desc) nextErrors[`items.${idx}.description`] = "Enter a description.";
      if (!Number.isFinite(qty) || qty <= 0) {
        nextErrors[`items.${idx}.quantity`] = "Enter quantity > 0.";
      }
      if (pricePaise === null) {
        nextErrors[`items.${idx}.unitPrice`] = "Enter valid price (e.g. 333.33).";
      }
      if (desc && Number.isFinite(qty) && qty > 0 && pricePaise !== null) {
        parsedPayloadItems.push({
          description: desc,
          quantity: Number(qty.toFixed(2)),
          unitPrice: item.unitPrice.trim(),
        });
      }
    });

    setLocalErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSubmit({
      customerId,
      issueDate,
      dueDate,
      gstRate: Number(gstNum.toFixed(2)),
      notes,
      terms,
      items: parsedPayloadItems,
    });
  };

  return (
    <form onSubmit={(e) => void handleFormSubmit(e)} noValidate className="space-y-6">
      {serverError ? <Alert variant="error">{serverError}</Alert> : null}

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">Customer &amp; Dates</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Field id="inv-customer" label="Customer" error={errors.customerId} required>
              <select
                id="inv-customer"
                name="customerId"
                required
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setLocalErrors((p) => ({ ...p, customerId: undefined }));
                }}
                aria-invalid={Boolean(errors.customerId)}
                className={inputClassName}
              >
                <option value="">Select a customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </Field>
            <p className="mt-1.5 text-xs text-slate-500">
              Need someone new?{" "}
              <Link href="/customers" className="font-medium text-blue-700 hover:underline">
                Manage customers
              </Link>
            </p>
          </div>

          <Field id="inv-issue-date" label="Invoice date" error={errors.issueDate} required>
            <input
              id="inv-issue-date"
              name="issueDate"
              type="date"
              required
              value={issueDate}
              onChange={(e) => handleIssueDateChange(e.target.value)}
              aria-invalid={Boolean(errors.issueDate)}
              className={inputClassName}
            />
          </Field>

          <Field id="inv-due-date" label="Due date" error={errors.dueDate} required>
            <input
              id="inv-due-date"
              name="dueDate"
              type="date"
              required
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setDueDateTouched(true);
                setLocalErrors((p) => ({ ...p, dueDate: undefined }));
              }}
              aria-invalid={Boolean(errors.dueDate)}
              className={inputClassName}
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Line Items</h2>
          <button
            type="button"
            onClick={() =>
              setItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }])
            }
            className={secondaryButtonClassName}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add item</span>
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {items.map((item, idx) => {
            const qty = Number(item.quantity);
            const pricePaise = parseRupeesToPaise(item.unitPrice);
            const lineTotal =
              Number.isFinite(qty) && qty > 0 && pricePaise !== null
                ? Math.round(qty * pricePaise)
                : 0;

            return (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4"
              >
                <div className="grid gap-3 sm:grid-cols-12 sm:items-start">
                  <div className="sm:col-span-5">
                    <Field
                      id={`item-desc-${idx}`}
                      label="Description"
                      error={errors[`items.${idx}.description`]}
                      required
                    >
                      <input
                        id={`item-desc-${idx}`}
                        type="text"
                        required
                        value={item.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItems((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, description: val } : row))
                          );
                          setLocalErrors((p) => ({
                            ...p,
                            [`items.${idx}.description`]: undefined,
                          }));
                        }}
                        aria-invalid={Boolean(errors[`items.${idx}.description`])}
                        className={inputClassName}
                        placeholder="Website design & setup"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:col-span-5">
                    <Field
                      id={`item-qty-${idx}`}
                      label="Quantity"
                      error={errors[`items.${idx}.quantity`]}
                      required
                    >
                      <input
                        id={`item-qty-${idx}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={item.quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItems((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, quantity: val } : row))
                          );
                          setLocalErrors((p) => ({
                            ...p,
                            [`items.${idx}.quantity`]: undefined,
                          }));
                        }}
                        aria-invalid={Boolean(errors[`items.${idx}.quantity`])}
                        className={inputClassName}
                      />
                    </Field>

                    <Field
                      id={`item-price-${idx}`}
                      label="Price (₹)"
                      error={errors[`items.${idx}.unitPrice`]}
                      required
                    >
                      <input
                        id={`item-price-${idx}`}
                        type="text"
                        inputMode="decimal"
                        required
                        value={item.unitPrice}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItems((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, unitPrice: val } : row))
                          );
                          setLocalErrors((p) => ({
                            ...p,
                            [`items.${idx}.unitPrice`]: undefined,
                          }));
                        }}
                        aria-invalid={Boolean(errors[`items.${idx}.unitPrice`])}
                        className={inputClassName}
                        placeholder="333.33"
                      />
                    </Field>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 sm:col-span-2 sm:flex-col sm:items-end sm:pt-7">
                    <span className="text-sm font-semibold text-slate-900">
                      {formatINR(lineTotal)}
                    </span>
                    {items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label={`Remove item ${idx + 1}`}
                        className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* GST and live totals */}
        <div className="mt-6 flex flex-col gap-5 border-t border-slate-200 pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="w-full sm:max-w-[200px]">
            <Field id="inv-gst" label="GST rate (%)" error={errors.gstRate} required>
              <input
                id="inv-gst"
                name="gstRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={gstRate}
                onChange={(e) => {
                  setGstRate(e.target.value);
                  setLocalErrors((p) => ({ ...p, gstRate: undefined }));
                }}
                aria-invalid={Boolean(errors.gstRate)}
                className={inputClassName}
              />
            </Field>
          </div>

          <dl className="w-full space-y-2 rounded-xl bg-slate-50 p-4 text-sm sm:max-w-xs">
            <div className="flex justify-between text-slate-600">
              <dt>Subtotal</dt>
              <dd className="font-medium text-slate-900">{formatINR(liveTotals.subtotalPaise)}</dd>
            </div>
            <div className="flex justify-between text-slate-600">
              <dt>GST ({safeGst}%)</dt>
              <dd className="font-medium text-slate-900">{formatINR(liveTotals.gstPaise)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <dt>Total</dt>
              <dd>{formatINR(liveTotals.totalPaise)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="inv-notes" label="Notes (e.g. bank details)">
            <textarea
              id="inv-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClassName}
            />
          </Field>

          <Field id="inv-terms" label="Terms & conditions">
            <textarea
              id="inv-terms"
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className={inputClassName}
            />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel ? (
          <button type="button" onClick={onCancel} className={secondaryButtonClassName}>
            Cancel
          </button>
        ) : (
          <Link href="/dashboard" className={secondaryButtonClassName}>
            Cancel
          </Link>
        )}
        <button type="submit" disabled={submitting} className={primaryButtonClassName}>
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
