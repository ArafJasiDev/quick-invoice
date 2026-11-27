import { getCurrentMonthRangeIST, getDisplayInvoiceStatus } from "./dates";
import type { InvoiceDTO } from "./types";

export interface MonthlyMetrics {
  invoicedPaise: number;
  receivedPaise: number;
  pendingPaise: number;
  invoicedCount: number;
  paidCount: number;
  overdueCount: number;
}

/**
 * Computes this IST month's invoiced, received, and still-to-come totals.
 * Draft invoices are excluded from invoiced/pending totals until sent.
 */
export function computeMonthlyMetrics(
  invoices: ReadonlyArray<Pick<InvoiceDTO, "status" | "issueDate" | "dueDate" | "totalPaise">>,
  now: Date = new Date()
): MonthlyMetrics {
  const { startDate, endDate } = getCurrentMonthRangeIST(now);
  let invoicedPaise = 0;
  let receivedPaise = 0;
  let pendingPaise = 0;
  let invoicedCount = 0;
  let paidCount = 0;
  let overdueCount = 0;

  for (const inv of invoices) {
    const issueDate = inv.issueDate.slice(0, 10);
    if (issueDate < startDate || issueDate > endDate) continue;
    if (inv.status === "draft") continue;

    invoicedPaise += inv.totalPaise;
    invoicedCount += 1;

    const displayStatus = getDisplayInvoiceStatus(inv.status, inv.dueDate, now);
    if (displayStatus === "paid") {
      receivedPaise += inv.totalPaise;
      paidCount += 1;
    } else {
      pendingPaise += inv.totalPaise;
      if (displayStatus === "overdue") {
        overdueCount += 1;
      }
    }
  }

  return {
    invoicedPaise,
    receivedPaise,
    pendingPaise,
    invoicedCount,
    paidCount,
    overdueCount,
  };
}
