import { NextResponse } from "next/server";
import { fetchInvoiceDetailForBusiness } from "@/lib/invoice-service";
import { calculateInvoiceTotals, parseRupeesToPaise } from "@/lib/money";
import type { CustomerRow } from "@/lib/supabase/mappers";
import { getAuthenticatedBusiness } from "@/lib/supabase/server";
import type { FieldErrors } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (!auth) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }
    const { id } = await context.params;
    const invoice = await fetchInvoiceDetailForBusiness(auth.supabase, auth.business.id, id);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }
    return NextResponse.json({ invoice });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load invoice.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface UpdateDraftBody {
  customerId?: string;
  issueDate?: string;
  dueDate?: string;
  gstRate?: number | string;
  notes?: string;
  terms?: string;
  items?: Array<{
    description?: string;
    quantity?: number | string;
    unitPrice?: number | string;
  }>;
}

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

    const { data: existing, error: fetchErr } = await auth.supabase
      .from("invoices")
      .select("id,status")
      .eq("id", id)
      .eq("business_id", auth.business.id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }
    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only Draft invoices can be edited. Sent and Paid invoices keep their original details." },
        { status: 409 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as UpdateDraftBody;
    const fieldErrors: FieldErrors = {};

    const customerId = (body.customerId ?? "").trim();
    if (!customerId) fieldErrors.customerId = "Select a customer.";

    const issueDate = (body.issueDate ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
      fieldErrors.issueDate = "Enter a valid invoice date.";
    }

    const dueDate = (body.dueDate ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      fieldErrors.dueDate = "Enter a valid due date.";
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(issueDate) && dueDate < issueDate) {
      fieldErrors.dueDate = "Due date cannot be before the invoice date.";
    }

    const gstRate = Number(body.gstRate);
    if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
      fieldErrors.gstRate = "Enter a GST rate between 0 and 100.";
    }

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) fieldErrors.items = "Add at least one line item.";

    const parsedItems: Array<{ description: string; quantity: number; unitPricePaise: number }> = [];
    rawItems.forEach((item, index) => {
      const desc = (item.description ?? "").trim();
      const qty = Number(item.quantity);
      const unitPricePaise = parseRupeesToPaise(item.unitPrice ?? "");

      if (!desc) fieldErrors[`items.${index}.description`] = "Enter an item description.";
      if (!Number.isFinite(qty) || qty <= 0) {
        fieldErrors[`items.${index}.quantity`] = "Enter a quantity greater than 0.";
      }
      if (unitPricePaise === null) {
        fieldErrors[`items.${index}.unitPrice`] = "Enter a valid price (e.g. 333.33).";
      }

      if (desc && Number.isFinite(qty) && qty > 0 && unitPricePaise !== null) {
        parsedItems.push({
          description: desc,
          quantity: Number(qty.toFixed(2)),
          unitPricePaise,
        });
      }
    });

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields.", fieldErrors },
        { status: 400 }
      );
    }

    const { data: customer, error: custErr } = await auth.supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .eq("business_id", auth.business.id)
      .maybeSingle();

    if (custErr || !customer) {
      return NextResponse.json({ error: "Selected customer was not found." }, { status: 400 });
    }
    const cust = customer as CustomerRow;
    const totals = calculateInvoiceTotals(parsedItems, Number(gstRate.toFixed(2)));

    // Draft follows current business settings until it is sent
    const { error: updateErr } = await auth.supabase
      .from("invoices")
      .update({
        customer_id: cust.id,
        issue_date: issueDate,
        due_date: dueDate,
        gst_rate: Number(gstRate.toFixed(2)),
        subtotal_paise: totals.subtotalPaise,
        gst_paise: totals.gstPaise,
        total_paise: totals.totalPaise,
        business_name_snapshot: auth.business.name,
        business_logo_snapshot: auth.business.logo_data_url,
        business_address_snapshot: auth.business.address,
        business_gstin_snapshot: auth.business.gstin,
        business_phone_snapshot: auth.business.phone,
        business_email_snapshot: auth.business.contact_email,
        notes_snapshot: (body.notes ?? "").trim(),
        terms_snapshot: (body.terms ?? "").trim(),
        customer_name_snapshot: cust.name,
        customer_email_snapshot: cust.email,
        customer_phone_snapshot: cust.phone,
      })
      .eq("id", id)
      .eq("business_id", auth.business.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const { error: delItemsErr } = await auth.supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", id)
      .eq("business_id", auth.business.id);

    if (delItemsErr) {
      return NextResponse.json({ error: delItemsErr.message }, { status: 500 });
    }

    const { error: insItemsErr } = await auth.supabase.from("invoice_items").insert(
      totals.items.map((item, idx) => ({
        invoice_id: id,
        business_id: auth.business.id,
        sort_order: idx,
        description: item.description,
        quantity: item.quantity,
        unit_price_paise: item.unitPricePaise,
        line_total_paise: item.lineTotalPaise,
      }))
    );

    if (insItemsErr) {
      return NextResponse.json({ error: insItemsErr.message }, { status: 500 });
    }

    const updated = await fetchInvoiceDetailForBusiness(auth.supabase, auth.business.id, id);
    return NextResponse.json({ invoice: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update invoice.";
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

    const { data: existing } = await auth.supabase
      .from("invoices")
      .select("id,status")
      .eq("id", id)
      .eq("business_id", auth.business.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }
    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only Draft invoices can be deleted." },
        { status: 409 }
      );
    }

    const { error } = await auth.supabase
      .from("invoices")
      .delete()
      .eq("id", id)
      .eq("business_id", auth.business.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete invoice.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
