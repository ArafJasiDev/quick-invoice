const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function buildAuthHeader(keyId: string, keySecret: string): string {
  const credentials = Buffer.from(`${keyId}:${keySecret}`, "utf8").toString("base64");
  return `Basic ${credentials}`;
}

interface RazorpayErrorBody {
  error?: {
    description?: string;
    code?: string;
  };
}

export interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface RazorpayPaymentResponse {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
}

export async function testRazorpayConnection(
  keyId: string,
  keySecret: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmedId = keyId.trim();
  const trimmedSecret = keySecret.trim();

  if (!trimmedId || !trimmedSecret) {
    return { ok: false, message: "Enter both Razorpay Key ID and Key Secret." };
  }

  if (!trimmedId.startsWith("rzp_test_") && !trimmedId.startsWith("rzp_live_")) {
    return {
      ok: false,
      message: "Razorpay Key ID should start with rzp_test_ (for Test Mode).",
    };
  }

  try {
    const response = await fetch(`${RAZORPAY_API_BASE}/orders?count=1`, {
      method: "GET",
      headers: {
        Authorization: buildAuthHeader(trimmedId, trimmedSecret),
      },
      cache: "no-store",
    });

    if (response.ok) {
      return { ok: true };
    }

    const body = (await response.json().catch(() => ({}))) as RazorpayErrorBody;
    const desc = body.error?.description;
    if (response.status === 401) {
      return {
        ok: false,
        message: "Razorpay rejected these keys. Check that your Key ID and Key Secret match.",
      };
    }
    return {
      ok: false,
      message: desc ?? `Razorpay returned status ${response.status}.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return {
      ok: false,
      message: `Could not reach Razorpay (${msg}). Please try again.`,
    };
  }
}

export async function createRazorpayOrder(params: {
  keyId: string;
  keySecret: string;
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrderResponse> {
  const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: buildAuthHeader(params.keyId, params.keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: "INR",
      receipt: params.receipt.slice(0, 40),
      notes: params.notes,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as RazorpayErrorBody;
    throw new Error(
      body.error?.description ?? `Razorpay order creation failed (${response.status}).`
    );
  }

  return (await response.json()) as RazorpayOrderResponse;
}

export async function fetchRazorpayPayment(params: {
  keyId: string;
  keySecret: string;
  paymentId: string;
}): Promise<RazorpayPaymentResponse> {
  const response = await fetch(
    `${RAZORPAY_API_BASE}/payments/${encodeURIComponent(params.paymentId)}`,
    {
      method: "GET",
      headers: {
        Authorization: buildAuthHeader(params.keyId, params.keySecret),
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as RazorpayErrorBody;
    throw new Error(
      body.error?.description ?? `Could not verify payment with Razorpay (${response.status}).`
    );
  }

  return (await response.json()) as RazorpayPaymentResponse;
}
