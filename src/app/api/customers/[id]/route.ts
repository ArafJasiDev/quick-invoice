import { NextResponse } from "next/server";
import { toCustomerDTO, type CustomerRow } from "@/lib/supabase/mappers";
import { getAuthenticatedBusiness } from "@/lib/supabase/server";
import { validateCustomerInput } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (!auth) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }
    const { id } = await context.params;
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
      .update({ name, email, phone })
      .eq("id", id)
      .eq("business_id", auth.business.id)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    return NextResponse.json({ customer: toCustomerDTO(data as CustomerRow) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update customer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (!auth) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }
    const { id } = await context.params;

    const { error } = await auth.supabase
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("business_id", auth.business.id);

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "This customer already has invoices and cannot be deleted." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete customer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
