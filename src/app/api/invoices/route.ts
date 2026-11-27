import { NextResponse } from "next/server";
import { computeMonthlyMetrics } from "@/lib/dashboard";
import { getCurrentMonthRangeIST, getDateStringIST } from "@/lib/dates";
import { calculateInvoiceTotals, parseRupeesToPaise } from "@/lib/money";
import { toInvoiceDTO, type InvoiceRow } from "@/lib/supabase/mappers";
import { getAuthenticatedBusiness } from "@/lib/supabase/server";
import type { FieldErrors } from "@/lib/validation";

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (!auth) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") ?? "all").toLowerCase();
    const search = (searchParams.get("search") ?? "").trim();
    const pageRaw = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

    const now = new Date();
    const todayIST = getDateStringIST(now);
    const monthRange = getCurrentMonthRangeIST(now);

    // 1. Query paginated list
    let listQuery = auth.supabase
      .from("invoices")
      .select("*", { count: "exact" })
      .eq("business_id", auth.business.id)
      .order("created_at", { ascending: false });

    if (status === "draft") {
      listQuery = listQuery.eq("status", "draft");
    } else if (status === "paid") {
      listQuery = listQuery.eq("status", "paid");
    } else if (status === "sent") {
      listQuery = listQuery.eq("status", "sent").gte("due_date", todayIST);
    } else if (status === "overdue") {
      listQuery = listQuery.eq("status", "sent").lt("due_date", todayIST);
    }

    if (search) {
      const safe = search.replaceAll(/[,%()]/g, " ").trim();
      if (safe) {
        listQuery = listQuery.or(
          `invoice_number.ilike.%${safe}%,customer_name_snapshot.ilike.%${safe}%,customer_email_snapshot.ilike.%${safe}%`
        );
      }
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    listQuery = listQuery.range(from, to);

    // 2. Query current IST month invoices for summary metrics
    const metricsQuery = auth.supabase
      .from("invoices")
      .select("status,issue_date,due_date,total_paise")
      .eq("business_id", auth.business.id)
      .gte("issue_date", monthRange.startDate)
      .lte("issue_date", monthRange.endDate);

    const [listRes, metricsRes] = await Promise.all([listQuery, metricsQuery]);

    if (listRes.error) {
      return NextResponse.json({ error: listRes.error.message }, { status: 500 });
    }
    if (metricsRes.error) {
      return NextResponse.json({ error: metricsRes.error.message }, { status: 500 });
    }

    const invoices = ((listRes.data ?? []) as InvoiceRow[]).map((row) => toInvoiceDTO(row, now));
    const totalCount = listRes.count ?? invoices.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    const monthInvoices = (metricsRes.data ?? []).map((row) => ({
      status: row.status as "draft" | "sent" | "paid",
      issueDate: String(row.issue_date),
      dueDate: String(row.due_date),
      totalPaise: Number(row.total_paise),
    }));
    const metrics = computeMonthlyMetrics(monthInvoices, now);

    return NextResponse.json({
      invoices,
      page,
      pageSize: PAGE_SIZE,
      totalCount,
      totalPages,
      metrics,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load invoices.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface CreateInvoiceBody {
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

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (!auth) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as CreateInvoiceBody;
    const fieldErrors: FieldErrors = {};

    const customerId = (body.customerId ?? "").trim();
    if (!customerId) {
      fieldErrors.customerId = "Select a customer for this invoice.";
    }

    const issueDate = (body.issueDate ?? getDateStringIST()).trim();
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
    if (rawItems.length === 0) {
      fieldErrors.items = "Add at least one line item.";
    }

    const parsedItems: Array<{ description: string; quantity: number; unitPricePaise: number }> = [];
    rawItems.forEach((item, index) => {
      const desc = (item.description ?? "").trim();
      const qty = Number(item.quantity);
      const unitPricePaise = parseRupeesToPaise(item.unitPrice ?? "");

      if (!desc) {
        fieldErrors[`items.${index}.description`] = "Enter an item description.";
      }
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

    const totals = calculateInvoiceTotals(parsedItems, Number(gstRate.toFixed(2)));

    const { data, error } = await auth.supabase.rpc("create_invoice_with_items", {
      p_business_id: auth.business.id,
      p_customer_id: customerId,
      p_issue_date: issueDate,
      p_due_date: dueDate,
      p_gst_rate: Number(gstRate.toFixed(2)),
      p_subtotal_paise: totals.subtotalPaise,
      p_gst_paise: totals.gstPaise,
      p_total_paise: totals.totalPaise,
      p_notes: (body.notes ?? "").trim(),
      p_terms: (body.terms ?? "").trim(),
      p_items: totals.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price_paise: item.unitPricePaise,
        line_total_paise: item.lineTotalPaise,
      })),
    });

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Could not create invoice." },
        { status: 400 }
      );
    }

    const invoiceRow = data as InvoiceRow;
    return NextResponse.json({ invoice: toInvoiceDTO(invoiceRow) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create invoice.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
