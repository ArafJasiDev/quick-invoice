import { NextResponse } from "next/server";
import { toCustomerDTO, type CustomerRow } from "@/lib/supabase/mappers";
import { getAuthenticatedBusiness } from "@/lib/supabase/server";
import { validateCustomerInput } from "@/lib/validation";

export async function GET() {
  try {
    const auth = await getAuthenticatedBusiness();
    if (!auth) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    const { data, error } = await auth.supabase
      .from("customers")
      .select("*")
      .eq("business_id", auth.business.id)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      customers: ((data ?? []) as CustomerRow[]).map(toCustomerDTO),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load customers.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (!auth) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      phone?: string;
    };

    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim();
    const phone = (body.phone ?? "").trim();

    const fieldErrors = validateCustomerInput({ name, email, phone });
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields.", fieldErrors },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("customers")
      .insert({
        business_id: auth.business.id,
        name,
        email,
        phone,
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Could not add customer." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { customer: toCustomerDTO(data as CustomerRow) },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add customer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
