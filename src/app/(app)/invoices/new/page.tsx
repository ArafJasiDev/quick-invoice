"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { InvoiceEditorForm } from "@/components/InvoiceEditorForm";
import { Alert, EmptyState, Spinner, primaryButtonClassName } from "@/components/ui";
import { addDaysToDateString, getDateStringIST } from "@/lib/dates";
import type { BusinessPublicDTO, CustomerDTO } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

export default function NewInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [business, setBusiness] = useState<BusinessPublicDTO | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<FieldErrors>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [custRes, bizRes] = await Promise.all([
        fetch("/api/customers", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      const custJson = (await custRes.json()) as { customers?: CustomerDTO[]; error?: string };
      const bizJson = (await bizRes.json()) as { business?: BusinessPublicDTO; error?: string };

      if (!custRes.ok) throw new Error(custJson.error ?? "Failed to load customers.");
      if (!bizRes.ok || !bizJson.business) {
        throw new Error(bizJson.error ?? "Failed to load business defaults.");
      }

      setCustomers(custJson.customers ?? []);
      setBusiness(bizJson.business);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not prepare invoice form.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading invoice form..." />
      </div>
    );
  }

  if (loadError || !business) {
    return (
      <Alert variant="error" title="Could not load form">
        <p>{loadError ?? "Missing business settings."}</p>
        <button
          type="button"
          onClick={() => void loadData()}
          className="mt-2 text-xs font-semibold underline"
        >
          Try again
        </button>
      </Alert>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Invoice</h1>
        <EmptyState
          title="Add a customer first"
          description="You need at least one customer before creating an invoice."
          action={
            <Link href="/customers" className={primaryButtonClassName}>
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Add your first customer</span>
            </Link>
          }
        />
      </div>
    );
  }

  const todayIST = getDateStringIST();
  const defaultDueDate = addDaysToDateString(todayIST, business.defaultDueDays);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Invoice</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your business details, default GST rate ({business.defaultGstRate}%), and next sequential
          number are applied automatically.
        </p>
      </div>

      <InvoiceEditorForm
        customers={customers}
        defaultDueDays={business.defaultDueDays}
        initialData={{
          customerId: customers[0]?.id ?? "",
          issueDate: todayIST,
          dueDate: defaultDueDate,
          gstRate: String(business.defaultGstRate),
          notes: business.defaultNotes,
          terms: business.defaultTerms,
          items: [{ description: "", quantity: "1", unitPrice: "" }],
        }}
        submitLabel="Create Draft Invoice"
        submitting={submitting}
        serverError={serverError}
        serverFieldErrors={serverFieldErrors}
        onSubmit={async (payload) => {
          setSubmitting(true);
          setServerError(null);
          setServerFieldErrors({});
          try {
            const res = await fetch("/api/invoices", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const json = (await res.json()) as {
              invoice?: { id: string };
              error?: string;
              fieldErrors?: FieldErrors;
            };
            if (!res.ok || !json.invoice) {
              if (json.fieldErrors) setServerFieldErrors(json.fieldErrors);
              throw new Error(json.error ?? "Could not create invoice.");
            }
            router.push(`/invoices/${json.invoice.id}`);
          } catch (err) {
            setServerError(err instanceof Error ? err.message : "Could not create invoice.");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </div>
  );
}
