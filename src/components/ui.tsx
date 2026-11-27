import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import type { DisplayInvoiceStatus } from "@/lib/dates";

export function StatusBadge({ status }: { status: DisplayInvoiceStatus }) {
  const styles: Record<DisplayInvoiceStatus, { bg: string; label: string }> = {
    draft: {
      bg: "bg-slate-100 text-slate-700 border-slate-200",
      label: "Draft",
    },
    sent: {
      bg: "bg-amber-50 text-amber-800 border-amber-200",
      label: "Sent",
    },
    paid: {
      bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
      label: "Paid",
    },
    overdue: {
      bg: "bg-rose-50 text-rose-800 border-rose-200",
      label: "Overdue",
    },
  };

  const cfg = styles[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${cfg.bg}`}
    >
      {cfg.label}
    </span>
  );
}

export function Alert({
  variant,
  title,
  children,
}: {
  variant: "error" | "success" | "info";
  title?: string;
  children: ReactNode;
}) {
  const config = {
    error: {
      wrap: "border-rose-200 bg-rose-50 text-rose-900",
      Icon: AlertCircle,
    },
    success: {
      wrap: "border-emerald-200 bg-emerald-50 text-emerald-900",
      Icon: CheckCircle2,
    },
    info: {
      wrap: "border-blue-200 bg-blue-50 text-blue-900",
      Icon: Info,
    },
  }[variant];

  const Icon = config.Icon;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${config.wrap}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-xs ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
        {required ? (
          <span className="ml-1 text-rose-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1.5 text-xs font-medium text-rose-700"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export function Spinner({ label = "Loading..." }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin text-blue-700" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export const inputClassName =
  "qi-input w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-700 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500";

export const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
