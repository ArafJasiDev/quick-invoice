/**
 * Exact integer-paisa currency arithmetic and Indian Rupee (INR) formatting.
 * 1 INR = 100 paise. All invoice calculations run in integer paise to avoid floating-point drift.
 */

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPricePaise: number;
}

export interface CalculatedLineItem extends LineItemInput {
  lineTotalPaise: number;
}

export interface InvoiceTotals {
  items: CalculatedLineItem[];
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
}

/**
 * Converts a user-entered Rupee amount (string or number, up to 2 decimal places)
 * into exact integer paise. Returns null if invalid or negative.
 */
export function parseRupeesToPaise(input: string | number): number | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * 100);
  }

  const trimmed = input.trim().replaceAll(",", "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;

  const [wholePart = "0", fracPart = ""] = trimmed.split(".");
  const whole = Number.parseInt(wholePart, 10);
  const frac = Number.parseInt(fracPart.padEnd(2, "0"), 10);
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(frac)) return null;

  const paise = whole * 100 + frac;
  return Number.isSafeInteger(paise) ? paise : null;
}

/**
 * Converts integer paise back to a plain 2-decimal rupee string suitable for form inputs.
 */
export function paiseToDecimalString(paise: number): string {
  const safe = Math.round(paise);
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}${rupees}.${String(rem).padStart(2, "0")}`;
}

/**
 * Computes exact line totals, subtotal, GST, and grand total in integer paise.
 * Example: 3 * Rs 333.33 (33333 paise) at 18% GST:
 *   subtotal = 99999 paise (Rs 999.99)
 *   gst = Math.round(99999 * 18 / 100) = 18000 paise (Rs 180.00)
 *   total = 117999 paise (Rs 1,179.99)
 */
export function calculateInvoiceTotals(
  items: LineItemInput[],
  gstRatePercent: number
): InvoiceTotals {
  if (!Number.isFinite(gstRatePercent) || gstRatePercent < 0 || gstRatePercent > 100) {
    throw new Error("GST rate must be between 0 and 100.");
  }

  const calculatedItems: CalculatedLineItem[] = items.map((item) => {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error("Item quantity must be greater than 0.");
    }
    if (!Number.isInteger(item.unitPricePaise) || item.unitPricePaise < 0) {
      throw new Error("Item unit price must be a non-negative integer in paise.");
    }
    const lineTotalPaise = Math.round(item.quantity * item.unitPricePaise);
    return {
      ...item,
      lineTotalPaise,
    };
  });

  const subtotalPaise = calculatedItems.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  // Multiply by basis points (gstRatePercent * 100) to avoid float imprecision on e.g. 2.5% or 18%
  const gstBasisPoints = Math.round(gstRatePercent * 100);
  const gstPaise = Math.round((subtotalPaise * gstBasisPoints) / 10000);
  const totalPaise = subtotalPaise + gstPaise;

  return {
    items: calculatedItems,
    subtotalPaise,
    gstPaise,
    totalPaise,
  };
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats integer paise using Indian numbering system: e.g. 11799900 -> "₹1,17,999.00".
 */
export function formatINR(paise: number): string {
  const rupees = Math.round(paise) / 100;
  return inrFormatter.format(rupees);
}
