"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import {
  Alert,
  Card,
  EmptyState,
  Spinner,
  StatusBadge,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui";
import type { MonthlyMetrics } from "@/lib/dashboard";
import { formatDisplayDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { InvoiceDTO } from "@/lib/types";

type StatusFilter = "all" | "draft" | "sent" | "paid" | "overdue";

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

export function InvoiceListView({ showMetrics }: { showMetrics: boolean }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [metrics, setMetrics] = useState<MonthlyMetrics | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status,
        page: String(page),
      });
      if (appliedSearch) params.set("search", appliedSearch);

      const res = await fetch(`/api/invoices?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        error?: string;
        invoices?: InvoiceDTO[];
        totalCount?: number;
        totalPages?: number;
        metrics?: MonthlyMetrics;
      };

      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load invoices.");
      }

      setInvoices(json.invoices ?? []);
      setTotalCount(json.totalCount ?? 0);
      setTotalPages(json.totalPages ?? 1);
      if (json.metrics) setMetrics(json.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load invoices.");
    } finally {
      setLoading(false);
    }
  }, [status, appliedSearch, page]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {showMetrics ? "Dashboard" : "Invoices"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {showMetrics
              ? "This month's billing summary and recent invoices."
              : "Filter, search, and manage all your invoices."}
          </p>
        </div>
        <Link href="/invoices/new" className={primaryButtonClassName}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New Invoice</span>
        </Link>
      </div>

      {showMetrics ? (
        <section aria-label="This month summary" className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Total invoiced (this month)
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {metrics ? formatINR(metrics.invoicedPaise) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {metrics ? `${metrics.invoicedCount} sent invoice(s)` : "Loading..."}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Total received (this month)
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {metrics ? formatINR(metrics.receivedPaise) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {metrics ? `${metrics.paidCount} paid` : "Loading..."}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Still to come (this month)
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-700">
              {metrics ? formatINR(metrics.pendingPaise) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {metrics
                ? metrics.overdueCount > 0
                  ? `${metrics.overdueCount} overdue`
                  : "No overdue invoices this month"
                : "Loading..."}
            </p>
          </Card>
        </section>
      ) : null}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Filter invoices by status"
            className="flex flex-wrap gap-1.5"
          >
            {STATUS_TABS.map((tab) => {
              const active = status === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setStatus(tab.value);
                    setPage(1);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-700 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <search className="w-full lg:max-w-xs">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  name="search"
                  aria-label="Search by customer or invoice number"
                  value={searchInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchInput(val);
                    if (!val.trim() && appliedSearch) {
                      setAppliedSearch("");
                      setPage(1);
                    }
                  }}
                  placeholder="Customer or invoice #"
                  className={`${inputClassName} pl-9`}
                />
              </div>
              <button type="submit" className={secondaryButtonClassName}>
                Search
              </button>
            </form>
          </search>
        </div>

        <div className="mt-5">
          {error ? (
            <Alert variant="error" title="Could not load invoices">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void loadInvoices()}
                className="mt-2 text-xs font-semibold underline"
              >
                Try again
              </button>
            </Alert>
          ) : loading ? (
            <div className="flex justify-center py-12">
              <Spinner label="Loading invoices..." />
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              title={
                appliedSearch || status !== "all"
                  ? "No matching invoices"
                  : "No invoices yet"
              }
              description={
                appliedSearch || status !== "all"
                  ? "Try clearing your search or switching the status filter."
                  : "Create your first invoice — make sure you have added a customer and configured your settings first."
              }
              action={
                appliedSearch || status !== "all" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("all");
                      setSearchInput("");
                      setAppliedSearch("");
                      setPage(1);
                    }}
                    className={secondaryButtonClassName}
                  >
                    Reset filters
                  </button>
                ) : (
                  <div className="flex flex-wrap justify-center gap-2.5">
                    <Link href="/customers" className={secondaryButtonClassName}>
                      Add a customer
                    </Link>
                    <Link href="/invoices/new" className={primaryButtonClassName}>
                      Create first invoice
                    </Link>
                  </div>
                )
              }
            />
          ) : (
            <>
              {/* Mobile card list (< 640px, works cleanly at 390px) */}
              <ul className="space-y-3 sm:hidden">
                {invoices.map((inv) => (
                  <li key={inv.id}>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{inv.invoiceNumber}</p>
                          <p className="truncate text-sm text-slate-600">
                            {inv.customerNameSnapshot}
                          </p>
                        </div>
                        <StatusBadge status={inv.displayStatus} />
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-sm">
                        <span className="text-slate-500">
                          Due {formatDisplayDate(inv.dueDate)}
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatINR(inv.totalPaise)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Desktop / Tablet table */}
              <div
                tabIndex={0}
                role="region"
                aria-label="Invoices table"
                className="qi-table-wrap hidden sm:block"
              >
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      <th className="py-3 pr-4">Invoice #</th>
                      <th className="py-3 pr-4">Customer</th>
                      <th className="py-3 pr-4">Invoice Date</th>
                      <th className="py-3 pr-4">Due Date</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="py-3.5 pr-4 font-semibold text-blue-700">
                          <Link href={`/invoices/${inv.id}`} className="hover:underline">
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                        <td className="py-3.5 pr-4">
                          <div className="font-medium text-slate-900">
                            {inv.customerNameSnapshot}
                          </div>
                          <div className="text-xs text-slate-500">
                            {inv.customerEmailSnapshot}
                          </div>
                        </td>
                        <td className="py-3.5 pr-4 whitespace-nowrap text-slate-600">
                          {formatDisplayDate(inv.issueDate)}
                        </td>
                        <td className="py-3.5 pr-4 whitespace-nowrap text-slate-600">
                          {formatDisplayDate(inv.dueDate)}
                        </td>
                        <td className="py-3.5 pr-4">
                          <StatusBadge status={inv.displayStatus} />
                        </td>
                        <td className="py-3.5 text-right font-semibold whitespace-nowrap text-slate-900">
                          {formatINR(inv.totalPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination (10 per page) */}
              <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                <p className="text-xs text-slate-600">
                  Showing page <span className="font-semibold">{page}</span> of{" "}
                  <span className="font-semibold">{totalPages}</span> ({totalCount} total)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={secondaryButtonClassName}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={secondaryButtonClassName}
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
