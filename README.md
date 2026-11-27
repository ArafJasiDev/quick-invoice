# Quick Invoice

A multi-tenant GST invoicing and online payment web application built with Next.js (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth + RLS), Razorpay (Test Mode), and per-business SMTP email delivery.

## What Works

- **Multi-tenant Business Accounts**: Sign up with email, password, and business name; strict PostgreSQL Row-Level Security (RLS) isolates every business's customers, invoices, payments, send logs, and settings.
- **Customer Management**: Add, edit, and delete customers (`name`, `email`, `phone`).
- **Per-Business Settings (Database-Backed & Encrypted)**:
  - **Invoice Settings**: Logo upload (normalized to PNG for consistent screen + PDF rendering), business address, GSTIN, phone, email, custom number prefix and next sequence number (`INV-0001`, `ABC/26-27/001`, etc.), default GST rate, default due days, default notes and terms. Sent invoices preserve their original snapshot even if settings change later.
  - **Payment Settings (Razorpay)**: Per-business Key ID, Key Secret, and Webhook Secret. Secrets are AES-256-GCM encrypted at rest using `APP_ENCRYPTION_KEY` and never returned to the client after saving. Includes a **Check connection** button and displays the business's dedicated webhook URL. Public links hide the Pay button when Razorpay is not connected.
  - **Email Settings**: Per-business SMTP configuration (e.g., Gmail + App Password), **Send test email** button, and editable subject/body templates supporting `{customer_name}`, `{invoice_number}`, `{amount}`, `{due_date}`, and `{payment_link}`.
- **Exact Paisa & GST Math**: Integer-paisa arithmetic (`3 × ₹333.33` @ `18%` = `₹999.99` subtotal, `₹180.00` GST, `₹1,179.99` total) with Indian numbering (`₹1,17,999.00`) and `29 Nov 2026` date formatting.
- **Atomic Sequential Invoice Numbering**: PostgreSQL `create_invoice_with_items` RPC locks the business row (`SELECT ... FOR UPDATE`) and checks uniqueness against existing numbers so concurrent requests or format changes never cause duplicates.
- **PDF Generation & Email Sending**: Server-side PDF via `pdf-lib` + embedded Noto Sans font (`₹` glyph supported) available on both internal and public links, attached automatically to invoice emails with send-attempt logging (`Sent` / `Failed` + plain-word error messages; failed sends leave Draft status unchanged).
- **Public Invoice Link & Razorpay Payments**: Customer views invoice without signing in, downloads PDF, and pays directly to that business's Razorpay account. Verified via both Checkout signature + Razorpay API check and Razorpay Webhook (`payment.captured` / `order.paid`), with idempotent payment recording so tab-closes, refreshes, or forged requests cannot double-record or fake a payment.
- **IST Overdue & Dashboard**: Overdue status activates the day after `due_date` in Indian Standard Time (`Asia/Kolkata`). Monthly metrics (invoiced, received, still to come), status filters (`Draft`, `Sent`, `Paid`, `Overdue`), search, 10/page pagination, and responsive 390px mobile support.
- **Bonus — Day-Before Due Date Reminder**: `/api/cron/reminders` (scheduled via `vercel.json`) sends an automated reminder email the day before an unpaid sent invoice's due date (at most once per invoice via `reminder_sent_at`).

## What Is Not Finished / Requires Deployment Setup

- **External Services**: Requires your Supabase project credentials, `APP_ENCRYPTION_KEY`, Razorpay Test Mode keys (entered in app Settings), and a Gmail App Password (entered in app Settings) to run live end-to-end flows.
- **Automated Browser E2E Tests**: Domain math, IST dates, sequential numbering allocation, template rendering, encryption, Razorpay signature verification, monthly dashboard metrics, and PDF generation are covered by Vitest unit tests; live Supabase/Razorpay/SMTP flows are verified manually against the deployed environment.

## Key Decisions

1. **Integer Paise Arithmetic**: All prices, taxes, and totals are stored as `bigint` paise in PostgreSQL and calculated in integer paise in `src/lib/money.ts` to prevent IEEE-754 rounding drift.
2. **AES-256-GCM Secret Storage**: Per-business secrets (`razorpay_key_secret_enc`, `razorpay_webhook_secret_enc`, `smtp_password_enc`) are encrypted server-side before saving and never returned by API DTOs.
3. **`pdf-lib` with Bundled Noto Sans Fonts**: Avoids headless Chromium dependencies on Vercel serverless functions while accurately rendering `₹` and PNG/JPEG business logos.
4. **Row-Locked Postgres RPC for Numbering & Idempotent Payments**: `create_invoice_with_items` and `record_razorpay_payment` enforce concurrency safety inside database transactions.
5. **Computed Overdue Status in IST**: Overdue status is derived dynamically from `status === 'sent' && todayIST > due_date`, avoiding stale status flags.

## Running Locally

### Prerequisites

- Node.js 20+ and npm
- A Supabase project ([supabase.com](https://supabase.com))

### Setup Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Apply database migrations**:
   Run the SQL in [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql) inside your Supabase **SQL Editor** (or push with Supabase CLI).
   - In Supabase **Authentication → Providers → Email**, make sure Email sign-in is enabled (turning off "Confirm email" lets test businesses sign in right after sign-up).

3. **Configure environment variables**:
   Copy `.env.example` to `.env.local` and fill in your values:
   ```bash
   cp .env.example .env.local
   ```
   Generate a 64-hex-character `APP_ENCRYPTION_KEY`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Run tests, lint, and dev server**:
   ```bash
   npm test
   npm run lint
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Time Spent

Approximately 6 hours (architecture, database migrations + RLS, core domain logic + Vitest suite, API routes, responsive UI, and verification).
