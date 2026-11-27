-- Quick Invoice initial schema, RLS policies, and atomic RPCs

create extension if not exists pgcrypto;

-- 1. Businesses (one per auth user)
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  logo_data_url text,
  address text not null default '',
  gstin text not null default '',
  phone text not null default '',
  contact_email text not null default '',
  invoice_prefix text not null default 'INV-',
  next_invoice_number integer not null default 1 check (next_invoice_number >= 1),
  invoice_number_padding integer not null default 4 check (invoice_number_padding between 1 and 8),
  default_gst_rate numeric(5,2) not null default 18.00 check (default_gst_rate >= 0 and default_gst_rate <= 100),
  default_due_days integer not null default 15 check (default_due_days >= 0 and default_due_days <= 365),
  default_notes text not null default '',
  default_terms text not null default '',
  razorpay_key_id text,
  razorpay_key_secret_enc text,
  razorpay_webhook_secret_enc text,
  smtp_host text not null default 'smtp.gmail.com',
  smtp_port integer not null default 465 check (smtp_port between 1 and 65535),
  smtp_secure boolean not null default true,
  smtp_email text,
  smtp_password_enc text,
  email_subject_template text not null default 'Invoice {invoice_number} from {business_name}',
  email_body_template text not null default E'Hi {customer_name},\n\nPlease find attached invoice {invoice_number} for {amount}, due on {due_date}.\n\nYou can view and pay your invoice online here:\n{payment_link}\n\nThank you for your business!',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_business_id on public.customers(business_id);

-- 3. Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_number text not null,
  public_token uuid not null unique default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  issue_date date not null,
  due_date date not null,
  gst_rate numeric(5,2) not null check (gst_rate >= 0 and gst_rate <= 100),
  subtotal_paise bigint not null check (subtotal_paise >= 0),
  gst_paise bigint not null check (gst_paise >= 0),
  total_paise bigint not null check (total_paise >= 0),
  business_name_snapshot text not null,
  business_logo_snapshot text,
  business_address_snapshot text not null default '',
  business_gstin_snapshot text not null default '',
  business_phone_snapshot text not null default '',
  business_email_snapshot text not null default '',
  notes_snapshot text not null default '',
  terms_snapshot text not null default '',
  customer_name_snapshot text not null,
  customer_email_snapshot text not null,
  customer_phone_snapshot text not null default '',
  sent_at timestamptz,
  paid_at timestamptz,
  reminder_sent_at timestamptz,
  razorpay_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, invoice_number)
);

create index if not exists idx_invoices_business_issue_date on public.invoices(business_id, issue_date desc);
create index if not exists idx_invoices_public_token on public.invoices(public_token);
create index if not exists idx_invoices_reminder_lookup on public.invoices(status, due_date) where reminder_sent_at is null;

-- 4. Invoice Line Items
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  sort_order integer not null default 0,
  description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price_paise bigint not null check (unit_price_paise >= 0),
  line_total_paise bigint not null check (line_total_paise >= 0)
);

create index if not exists idx_invoice_items_invoice_id on public.invoice_items(invoice_id, sort_order);

-- 5. Invoice Send Logs
create table if not exists public.invoice_send_logs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_send_logs_invoice_id on public.invoice_send_logs(invoice_id, created_at desc);

-- 6. Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  razorpay_order_id text not null,
  razorpay_payment_id text not null unique,
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR',
  source text not null check (source in ('checkout', 'webhook')),
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_invoice_id on public.payments(invoice_id);

-- Updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_businesses_updated_at on public.businesses;
create trigger trg_businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- Auto-create business row when a new auth user signs up with business_name metadata
create or replace function public.handle_new_user_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_name text;
begin
  v_business_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'business_name', '')), '');
  if v_business_name is null then
    v_business_name := split_part(coalesce(new.email, 'My Business'), '@', 1);
  end if;

  insert into public.businesses (owner_user_id, name, contact_email)
  values (new.id, v_business_name, coalesce(new.email, ''))
  on conflict (owner_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_business();

-- Row-Level Security (strict multi-tenant isolation)
alter table public.businesses enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_send_logs enable row level security;
alter table public.payments enable row level security;

create policy "businesses_select_own" on public.businesses
  for select using (owner_user_id = auth.uid());

create policy "businesses_insert_own" on public.businesses
  for insert with check (owner_user_id = auth.uid());

create policy "businesses_update_own" on public.businesses
  for update using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "customers_own_all" on public.customers
  for all using (
    business_id in (select id from public.businesses where owner_user_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_user_id = auth.uid())
  );

create policy "invoices_own_all" on public.invoices
  for all using (
    business_id in (select id from public.businesses where owner_user_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_user_id = auth.uid())
  );

create policy "invoice_items_own_all" on public.invoice_items
  for all using (
    business_id in (select id from public.businesses where owner_user_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_user_id = auth.uid())
  );

create policy "invoice_send_logs_own_all" on public.invoice_send_logs
  for all using (
    business_id in (select id from public.businesses where owner_user_id = auth.uid())
  )
  with check (
    business_id in (select id from public.businesses where owner_user_id = auth.uid())
  );

create policy "payments_own_select" on public.payments
  for select using (
    business_id in (select id from public.businesses where owner_user_id = auth.uid())
  );

-- Atomic invoice creation with concurrency-safe sequential numbering
create or replace function public.create_invoice_with_items(
  p_business_id uuid,
  p_customer_id uuid,
  p_issue_date date,
  p_due_date date,
  p_gst_rate numeric,
  p_subtotal_paise bigint,
  p_gst_paise bigint,
  p_total_paise bigint,
  p_notes text,
  p_terms text,
  p_items jsonb
)
returns public.invoices
language plpgsql
security invoker
as $$
declare
  v_biz public.businesses%rowtype;
  v_cust public.customers%rowtype;
  v_num integer;
  v_padded text;
  v_invoice_number text;
  v_invoice public.invoices%rowtype;
  v_item jsonb;
  v_idx integer := 0;
begin
  -- Row lock prevents two concurrent creates from taking the same sequence number
  select * into v_biz
  from public.businesses
  where id = p_business_id and owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Business not found or access denied';
  end if;

  select * into v_cust
  from public.customers
  where id = p_customer_id and business_id = p_business_id;

  if not found then
    raise exception 'Customer not found for this business';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one invoice item is required';
  end if;

  v_num := greatest(v_biz.next_invoice_number, 1);

  loop
    if length(v_num::text) >= v_biz.invoice_number_padding then
      v_padded := v_num::text;
    else
      v_padded := lpad(v_num::text, v_biz.invoice_number_padding, '0');
    end if;

    v_invoice_number := v_biz.invoice_prefix || v_padded;

    exit when not exists (
      select 1
      from public.invoices
      where business_id = p_business_id
        and invoice_number = v_invoice_number
    );

    v_num := v_num + 1;
  end loop;

  update public.businesses
  set next_invoice_number = v_num + 1
  where id = p_business_id;

  insert into public.invoices (
    business_id,
    customer_id,
    invoice_number,
    status,
    issue_date,
    due_date,
    gst_rate,
    subtotal_paise,
    gst_paise,
    total_paise,
    business_name_snapshot,
    business_logo_snapshot,
    business_address_snapshot,
    business_gstin_snapshot,
    business_phone_snapshot,
    business_email_snapshot,
    notes_snapshot,
    terms_snapshot,
    customer_name_snapshot,
    customer_email_snapshot,
    customer_phone_snapshot
  ) values (
    p_business_id,
    p_customer_id,
    v_invoice_number,
    'draft',
    p_issue_date,
    p_due_date,
    p_gst_rate,
    p_subtotal_paise,
    p_gst_paise,
    p_total_paise,
    v_biz.name,
    v_biz.logo_data_url,
    v_biz.address,
    v_biz.gstin,
    v_biz.phone,
    v_biz.contact_email,
    coalesce(p_notes, v_biz.default_notes),
    coalesce(p_terms, v_biz.default_terms),
    v_cust.name,
    v_cust.email,
    v_cust.phone
  )
  returning * into v_invoice;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.invoice_items (
      invoice_id,
      business_id,
      sort_order,
      description,
      quantity,
      unit_price_paise,
      line_total_paise
    ) values (
      v_invoice.id,
      p_business_id,
      v_idx,
      v_item ->> 'description',
      (v_item ->> 'quantity')::numeric,
      (v_item ->> 'unit_price_paise')::bigint,
      (v_item ->> 'line_total_paise')::bigint
    );
    v_idx := v_idx + 1;
  end loop;

  return v_invoice;
end;
$$;

-- Idempotent payment recording (called server-side after signature verification)
create or replace function public.record_razorpay_payment(
  p_invoice_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_amount_paise bigint,
  p_currency text,
  p_source text,
  p_raw_payload jsonb default '{}'::jsonb
)
returns table (
  already_recorded boolean,
  invoice_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_existing_payment_id uuid;
begin
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;

  select id into v_existing_payment_id
  from public.payments
  where razorpay_payment_id = p_razorpay_payment_id;

  if found then
    return query select true, v_invoice.status;
    return;
  end if;

  insert into public.payments (
    invoice_id,
    business_id,
    razorpay_order_id,
    razorpay_payment_id,
    amount_paise,
    currency,
    source,
    raw_payload
  ) values (
    v_invoice.id,
    v_invoice.business_id,
    p_razorpay_order_id,
    p_razorpay_payment_id,
    p_amount_paise,
    coalesce(nullif(p_currency, ''), 'INR'),
    p_source,
    p_raw_payload
  );

  if v_invoice.status <> 'paid' then
    update public.invoices
    set status = 'paid',
        paid_at = coalesce(paid_at, now()),
        razorpay_order_id = coalesce(razorpay_order_id, p_razorpay_order_id)
    where id = v_invoice.id;

    return query select false, 'paid'::text;
  else
    return query select false, v_invoice.status;
  end if;
end;
$$;
