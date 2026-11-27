/**
 * Invoice number formatting and sequential collision-free helpers.
 */

/**
 * Formats an invoice number from prefix, sequence number, and zero-padding width.
 * Never truncates if number exceeds padding width (e.g. 10000 with padding 4 -> "10000").
 */
export function formatInvoiceNumber(
  prefix: string,
  sequenceNumber: number,
  padding: number
): string {
  const safeNum = Math.max(1, Math.floor(sequenceNumber));
  const safePad = Math.min(8, Math.max(1, Math.floor(padding)));
  const numStr = String(safeNum);
  const padded = numStr.length >= safePad ? numStr : numStr.padStart(safePad, "0");
  return `${prefix}${padded}`;
}

/**
 * Parses a "next number" input like "0001" or "001" into { number: 1, padding: 4 }.
 * Returns null if input is not a positive digit string.
 */
export function parseNextNumberInput(raw: string): {
  nextNumber: number;
  padding: number;
} | null {
  const trimmed = raw.trim();
  if (!/^\d{1,8}$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return {
    nextNumber: parsed,
    padding: Math.min(8, Math.max(1, trimmed.length)),
  };
}

/**
 * Pure simulation of collision-safe invoice number allocation, matching the PostgreSQL
 * `create_invoice_with_items` RPC logic.
 */
export function allocateNextAvailableInvoiceNumber(
  prefix: string,
  startingNumber: number,
  padding: number,
  existingNumbers: ReadonlySet<string>
): { invoiceNumber: string; nextNumberAfter: number } {
  let current = Math.max(1, Math.floor(startingNumber));
  while (true) {
    const candidate = formatInvoiceNumber(prefix, current, padding);
    if (!existingNumbers.has(candidate)) {
      return {
        invoiceNumber: candidate,
        nextNumberAfter: current + 1,
      };
    }
    current += 1;
  }
}
