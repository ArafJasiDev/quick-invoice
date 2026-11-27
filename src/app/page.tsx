import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, FileText, Mail, ShieldCheck } from "lucide-react";
import { getAuthenticatedBusiness } from "@/lib/supabase/server";

export default async function HomePage() {
  const auth = await getAuthenticatedBusiness().catch(() => null);
  if (auth) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5 font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold text-white">
              QI
            </span>
            <span className="text-lg tracking-tight">Quick Invoice</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="max-w-2xl space-y-5">
          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
            Built for Indian Small Businesses
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Send GST invoices, attach PDFs, and get paid online.
          </h1>
          <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
            Set up your business profile, connect your own Razorpay Test Mode account and email
            address, and send professional invoices to your customers in minutes.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-xs hover:bg-blue-800"
            >
              Set up your business
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Sign in to existing business
            </Link>
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Exact GST & Paisa Math",
              body: "Accurate down to the last paisa with Indian Rupee formatting and IST due dates.",
              Icon: FileText,
            },
            {
              title: "Your Own Email",
              body: "Send invoices directly from your own email account with PDFs attached.",
              Icon: Mail,
            },
            {
              title: "Your Own Razorpay",
              body: "Payments go straight to your connected Razorpay account with webhook verification.",
              Icon: ShieldCheck,
            },
            {
              title: "Instant PDF & Tracking",
              body: "Track Draft, Sent, Paid, and Overdue invoices from one clean dashboard.",
              Icon: CheckCircle2,
            },
          ].map(({ title, body, Icon }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold text-slate-900">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
