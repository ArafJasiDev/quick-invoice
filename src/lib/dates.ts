/**
 * Date and Indian Standard Time (IST, Asia/Kolkata, UTC+05:30) helpers.
 * All business dates (issue_date, due_date, overdue evaluation, monthly dashboard window)
 * use IST calendar dates formatted as YYYY-MM-DD.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Returns the YYYY-MM-DD calendar date in IST for the given instant.
 */
export function getDateStringIST(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Adds a whole number of calendar days to a YYYY-MM-DD date string.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = parseDateParts(dateStr);
  const utc = Date.UTC(y, m - 1, d + days);
  const dt = new Date(utc);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the [startDate, endDate] inclusive YYYY-MM-DD range for the current IST month.
 */
export function getCurrentMonthRangeIST(now: Date = new Date()): {
  startDate: string;
  endDate: string;
} {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth(); // 0-indexed
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const mm = String(month + 1).padStart(2, "0");
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 * Formats a YYYY-MM-DD string or Date/ISO timestamp as "29 Nov 2026".
 */
export function formatDisplayDate(input: string | Date): string {
  if (input instanceof Date) {
    return formatDisplayDate(getDateStringIST(input));
  }
  const dateOnly = input.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) && input.length === 10) {
    const [year, month, day] = parseDateParts(dateOnly);
    const monthName = MONTHS_SHORT[month - 1] ?? "Jan";
    return `${day} ${monthName} ${year}`;
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }
  return formatDisplayDate(getDateStringIST(parsed));
}

/**
 * Formats an ISO timestamp in IST as "29 Nov 2026, 4:00 PM IST".
 */
export function formatDisplayDateTimeIST(input: string | Date): string {
  const dt = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dt.getTime())) return String(input);

  const datePart = formatDisplayDate(dt);
  const ist = new Date(dt.getTime() + IST_OFFSET_MS);
  const hours24 = ist.getUTCHours();
  const minutes = String(ist.getUTCMinutes()).padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${datePart}, ${hours12}:${minutes} ${period} IST`;
}

export type StoredInvoiceStatus = "draft" | "sent" | "paid";
export type DisplayInvoiceStatus = "draft" | "sent" | "paid" | "overdue";

/**
 * An unpaid sent invoice shows Overdue starting the day after its due_date in IST.
 * Drafts remain Draft; Paid remains Paid.
 */
export function getDisplayInvoiceStatus(
  status: StoredInvoiceStatus,
  dueDate: string,
  now: Date = new Date()
): DisplayInvoiceStatus {
  if (status === "paid") return "paid";
  if (status === "draft") return "draft";
  const todayIST = getDateStringIST(now);
  return todayIST > dueDate.slice(0, 10) ? "overdue" : "sent";
}

function parseDateParts(dateStr: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error(`Invalid YYYY-MM-DD date string: "${dateStr}"`);
  }
  return [
    Number.parseInt(match[1] ?? "1970", 10),
    Number.parseInt(match[2] ?? "1", 10),
    Number.parseInt(match[3] ?? "1", 10),
  ];
}
