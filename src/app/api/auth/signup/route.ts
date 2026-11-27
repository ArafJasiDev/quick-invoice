import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isValidEmail, type FieldErrors } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      businessName?: string;
      email?: string;
      password?: string;
    };

    const businessName = (body.businessName ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    const fieldErrors: FieldErrors<"businessName" | "email" | "password"> = {};
    if (!businessName) {
      fieldErrors.businessName = "Enter your business name.";
    }
    if (!email) {
      fieldErrors.email = "Enter an email address.";
    } else if (!isValidEmail(email)) {
      fieldErrors.email = "Enter an email address in the format you@example.com.";
    }
    if (!password) {
      fieldErrors.password = "Choose a password.";
    } else if (password.length < 8) {
      fieldErrors.password = "Password must be at least 8 characters long.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields.", fieldErrors },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        business_name: businessName,
      },
    });

    if (error || !data.user) {
      const msg = (error?.message ?? "").toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("registered") ||
        msg.includes("exists") ||
        error?.status === 422
      ) {
        return NextResponse.json(
          {
            error: "An account with this email already exists. Please sign in instead.",
            duplicate: true,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: error?.message ?? "Could not create account." },
        { status: 400 }
      );
    }

    // Guarantee business profile row exists with exact businessName
    const { error: bizErr } = await admin
      .from("businesses")
      .upsert(
        {
          owner_user_id: data.user.id,
          name: businessName,
          contact_email: email,
        },
        { onConflict: "owner_user_id" }
      );

    if (bizErr) {
      return NextResponse.json(
        { error: `Account created, but failed to initialize business: ${bizErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, email, businessName },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
