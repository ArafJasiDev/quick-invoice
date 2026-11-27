import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { testRazorpayConnection } from "@/lib/razorpay";
import { getAuthenticatedBusiness } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (!auth) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      keyId?: string;
      keySecret?: string;
    };

    const keyId = (body.keyId ?? auth.business.razorpay_key_id ?? "").trim();
    let keySecret = (body.keySecret ?? "").trim();

    if (!keySecret && auth.business.razorpay_key_secret_enc) {
      keySecret = decryptSecret(auth.business.razorpay_key_secret_enc);
    }

    if (!keyId || !keySecret) {
      return NextResponse.json(
        {
          ok: false,
          message: "Enter both your Razorpay Key ID and Key Secret to test the connection.",
        },
        { status: 400 }
      );
    }

    const result = await testRazorpayConnection(keyId, keySecret);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Connection succeeded! Your Razorpay keys work.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not check Razorpay connection.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
