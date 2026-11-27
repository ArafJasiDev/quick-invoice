import { describe, expect, it } from "vitest";
import {
  calculateInvoiceTotals,
  formatINR,
  paiseToDecimalString,
  parseRupeesToPaise,
} from "../money";
import {
  addDaysToDateString,
  formatDisplayDate,
  getCurrentMonthRangeIST,
  getDateStringIST,
  getDisplayInvoiceStatus,
} from "../dates";
import {
  allocateNextAvailableInvoiceNumber,
  formatInvoiceNumber,
  parseNextNumberInput,
} from "../invoice-number";
import { renderEmailTemplate } from "../email-template";
import {
  decryptSecret,
  encryptSecret,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "../crypto";
import { computeMonthlyMetrics } from "../dashboard";
import { generateInvoicePdf } from "../pdf";
import crypto from "node:crypto";

describe("money calculations and Indian formatting", () => {
  it("computes exact paisa math for 3 × ₹333.33 at 18% GST", () => {
    const unitPricePaise = parseRupeesToPaise("333.33");
    expect(unitPricePaise).toBe(33333);

    const totals = calculateInvoiceTotals(
      [{ description: "Design retainer", quantity: 3, unitPricePaise: unitPricePaise! }],
      18
    );

    expect(totals.subtotalPaise).toBe(99999);
    expect(totals.gstPaise).toBe(18000);
    expect(totals.totalPaise).toBe(117999);

    expect(formatINR(totals.subtotalPaise)).toBe("₹999.99");
    expect(formatINR(totals.gstPaise)).toBe("₹180.00");
    expect(formatINR(totals.totalPaise)).toBe("₹1,179.99");
  });

  it("formats larger INR amounts using Indian lakhs/crores grouping", () => {
    expect(formatINR(11799900)).toBe("₹1,17,999.00");
    expect(paiseToDecimalString(117999)).toBe("1179.99");
  });

  it("rejects invalid rupee inputs", () => {
    expect(parseRupeesToPaise("")).toBeNull();
    expect(parseRupeesToPaise("-10")).toBeNull();
    expect(parseRupeesToPaise("10.123")).toBeNull();
    expect(parseRupeesToPaise("1,250.5")).toBe(125050);
  });
});

describe("IST dates and overdue status", () => {
  it("formats dates as '29 Nov 2026'", () => {
    expect(formatDisplayDate("2026-11-29")).toBe("29 Nov 2026");
  });

  it("evaluates Overdue strictly from the day after due date in IST", () => {
    // 2026-11-29 23:55 IST = 2026-11-29T18:25:00Z
    const lateOnDueDateIST = new Date("2026-11-29T18:25:00.000Z");
    expect(getDateStringIST(lateOnDueDateIST)).toBe("2026-11-29");
    expect(getDisplayInvoiceStatus("sent", "2026-11-29", lateOnDueDateIST)).toBe("sent");

    // 2026-11-30 00:05 IST = 2026-11-29T18:35:00Z (already 18:35 UTC on Nov 29)
    const fiveMinPastMidnightIST = new Date("2026-11-29T18:35:00.000Z");
    expect(getDateStringIST(fiveMinPastMidnightIST)).toBe("2026-11-30");
    expect(getDisplayInvoiceStatus("sent", "2026-11-29", fiveMinPastMidnightIST)).toBe("overdue");

    // Draft and Paid never turn Overdue
    expect(getDisplayInvoiceStatus("draft", "2026-11-01", fiveMinPastMidnightIST)).toBe("draft");
    expect(getDisplayInvoiceStatus("paid", "2026-11-01", fiveMinPastMidnightIST)).toBe("paid");
  });

  it("computes IST month bounds and adds days cleanly", () => {
    expect(addDaysToDateString("2026-11-29", 15)).toBe("2026-12-14");
    const range = getCurrentMonthRangeIST(new Date("2026-11-29T12:00:00.000Z"));
    expect(range).toEqual({ startDate: "2026-11-01", endDate: "2026-11-30" });
  });
});

describe("sequential invoice numbering", () => {
  it("supports custom prefix and padding formats without truncating large numbers", () => {
    expect(parseNextNumberInput("0001")).toEqual({ nextNumber: 1, padding: 4 });
    expect(parseNextNumberInput("001")).toEqual({ nextNumber: 1, padding: 3 });
    expect(formatInvoiceNumber("INV-", 1, 4)).toBe("INV-0001");
    expect(formatInvoiceNumber("ABC/26-27/", 1, 3)).toBe("ABC/26-27/001");
    expect(formatInvoiceNumber("ABC/26-27/", 1000, 3)).toBe("ABC/26-27/1000");
  });

  it("skips existing numbers when format changes or resets to avoid collisions", () => {
    const existing = new Set(["INV-0001", "INV-0002", "ABC/26-27/001"]);
    const alloc1 = allocateNextAvailableInvoiceNumber("INV-", 1, 4, existing);
    expect(alloc1).toEqual({ invoiceNumber: "INV-0003", nextNumberAfter: 4 });

    const alloc2 = allocateNextAvailableInvoiceNumber("ABC/26-27/", 1, 3, existing);
    expect(alloc2).toEqual({ invoiceNumber: "ABC/26-27/002", nextNumberAfter: 3 });
  });
});

describe("email template placeholders", () => {
  it("replaces all supported placeholders anywhere in subject and message", () => {
    const rendered = renderEmailTemplate(
      "Hi {customer_name}, Invoice {invoice_number} for {amount} due {due_date}: {payment_link} - {business_name}",
      {
        customerName: "Asha Traders",
        invoiceNumber: "INV-0007",
        amount: "₹1,179.99",
        dueDate: "29 Nov 2026",
        paymentLink: "https://example.com/i/abc",
        businessName: "Magizh Studio",
      }
    );

    expect(rendered).toBe(
      "Hi Asha Traders, Invoice INV-0007 for ₹1,179.99 due 29 Nov 2026: https://example.com/i/abc - Magizh Studio"
    );
  });
});

describe("secret encryption and Razorpay signature verification", () => {
  const testHexKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  it("encrypts and decrypts secrets via AES-256-GCM without storing plaintext", () => {
    const secret = "rzp_secret_value_123";
    const encrypted = encryptSecret(secret, testHexKey);
    expect(encrypted).not.toContain(secret);
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(decryptSecret(encrypted, testHexKey)).toBe(secret);
  });

  it("verifies valid Razorpay checkout signatures and rejects forged ones", () => {
    const keySecret = "test_key_secret";
    const orderId = "order_12345";
    const paymentId = "pay_67890";
    const validSig = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(
      verifyRazorpayCheckoutSignature({
        orderId,
        paymentId,
        signature: validSig,
        keySecret,
      })
    ).toBe(true);

    expect(
      verifyRazorpayCheckoutSignature({
        orderId,
        paymentId,
        signature: "forged_signature",
        keySecret,
      })
    ).toBe(false);

    expect(
      verifyRazorpayCheckoutSignature({
        orderId,
        paymentId,
        signature: validSig,
        keySecret: "wrong_secret",
      })
    ).toBe(false);
  });

  it("verifies valid Razorpay webhook signatures and rejects forged payloads", () => {
    const webhookSecret = "whsec_test_123";
    const rawBody = JSON.stringify({ event: "payment.captured", payload: {} });
    const validSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    expect(
      verifyRazorpayWebhookSignature({
        rawBody,
        signature: validSig,
        webhookSecret,
      })
    ).toBe(true);

    expect(
      verifyRazorpayWebhookSignature({
        rawBody: rawBody + " ",
        signature: validSig,
        webhookSecret,
      })
    ).toBe(false);
  });
});

describe("dashboard monthly metrics", () => {
  it("computes this month's invoiced, received, and pending excluding drafts", () => {
    const now = new Date("2026-11-27T12:00:00.000Z");
    const metrics = computeMonthlyMetrics(
      [
        { status: "draft", issueDate: "2026-11-10", dueDate: "2026-11-20", totalPaise: 50000 },
        { status: "paid", issueDate: "2026-11-05", dueDate: "2026-11-20", totalPaise: 100000 },
        { status: "sent", issueDate: "2026-11-10", dueDate: "2026-11-25", totalPaise: 40000 }, // overdue
        { status: "sent", issueDate: "2026-11-25", dueDate: "2026-12-10", totalPaise: 60000 }, // sent
        { status: "paid", issueDate: "2026-10-29", dueDate: "2026-11-10", totalPaise: 99999 }, // prev month
      ],
      now
    );

    expect(metrics).toEqual({
      invoicedPaise: 200000,
      receivedPaise: 100000,
      pendingPaise: 100000,
      invoicedCount: 3,
      paidCount: 1,
      overdueCount: 1,
    });
  });
});

describe("PDF generation", () => {
  it("generates a valid PDF buffer including PAID badge and rupee amounts", async () => {
    const pdf = await generateInvoicePdf({
      invoiceNumber: "INV-0001",
      status: "paid",
      issueDate: "2026-11-27",
      dueDate: "2026-12-12",
      gstRate: 18,
      subtotalPaise: 99999,
      gstPaise: 18000,
      totalPaise: 117999,
      businessName: "Magizh Test Studio",
      businessLogo: null,
      businessAddress: "12 Anna Salai, Chennai",
      businessGstin: "33ABCDE1234F1Z5",
      businessPhone: "+91 98765 43210",
      businessEmail: "billing@magizh.test",
      customerName: "Asha Traders",
      customerEmail: "asha@example.com",
      customerPhone: "+91 99999 88888",
      notes: "Thank you for your business.",
      terms: "Due within 15 days.",
      items: [
        {
          description: "UI/UX Sprint",
          quantity: 3,
          unitPricePaise: 33333,
          lineTotalPaise: 99999,
        },
      ],
    });

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
