"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Check, Copy, CreditCard, FileText, Mail, ShieldCheck } from "lucide-react";
import {
  Alert,
  Card,
  Field,
  Spinner,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui";
import { formatInvoiceNumber } from "@/lib/invoice-number";
import { SUPPORTED_EMAIL_PLACEHOLDERS } from "@/lib/email-template";
import type { BusinessPublicDTO } from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

type SettingsTab = "invoice" | "payment" | "email";

function normalizeLogoToPngDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Selected file is not a valid image."));
      img.onload = () => {
        const maxSide = 360;
        const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process logo image."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("invoice");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [business, setBusiness] = useState<BusinessPublicDTO | null>(null);
  const [origin, setOrigin] = useState("");

  // Invoice Settings state
  const [name, setName] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");
  const [nextNumberInput, setNextNumberInput] = useState("0001");
  const [defaultGstRate, setDefaultGstRate] = useState("18");
  const [defaultDueDays, setDefaultDueDays] = useState("15");
  const [defaultNotes, setDefaultNotes] = useState("");
  const [defaultTerms, setDefaultTerms] = useState("");

  // Payment Settings state (secrets stay blank after save)
  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [razorpayWebhookSecret, setRazorpayWebhookSecret] = useState("");
  const [rzpCheckStatus, setRzpCheckStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [checkingRzp, setCheckingRzp] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Email Settings state
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpEmail, setSmtpEmail] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [emailSubjectTemplate, setEmailSubjectTemplate] = useState("");
  const [emailBodyTemplate, setEmailBodyTemplate] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveFeedback, setSaveFeedback] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);

  const applyBusinessToState = (b: BusinessPublicDTO) => {
    setBusiness(b);
    setName(b.name);
    setLogoDataUrl(b.logoDataUrl);
    setAddress(b.address);
    setGstin(b.gstin);
    setPhone(b.phone);
    setContactEmail(b.contactEmail);
    setInvoicePrefix(b.invoicePrefix);
    setNextNumberInput(String(b.nextInvoiceNumber).padStart(b.invoiceNumberPadding, "0"));
    setDefaultGstRate(String(b.defaultGstRate));
    setDefaultDueDays(String(b.defaultDueDays));
    setDefaultNotes(b.defaultNotes);
    setDefaultTerms(b.defaultTerms);

    setRazorpayKeyId(b.razorpayKeyId ?? "");
    setRazorpayKeySecret("");
    setRazorpayWebhookSecret("");

    setSmtpHost(b.smtpHost || "smtp.gmail.com");
    setSmtpPort(String(b.smtpPort || 465));
    setSmtpSecure(b.smtpSecure);
    setSmtpEmail(b.smtpEmail ?? "");
    setSmtpPassword("");
    setEmailSubjectTemplate(b.emailSubjectTemplate);
    setEmailBodyTemplate(b.emailBodyTemplate);
    if (!testRecipient && b.smtpEmail) setTestRecipient(b.smtpEmail);
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const json = (await res.json()) as { business?: BusinessPublicDTO; error?: string };
      if (!res.ok || !json.business) {
        throw new Error(json.error ?? "Failed to load settings.");
      }
      applyBusinessToState(json.business);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadSettings();
  }, [loadSettings]);

  const handleLogoFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFieldErrors((p) => ({ ...p, logoDataUrl: undefined }));
    try {
      const dataUrl = await normalizeLogoToPngDataUrl(file);
      setLogoDataUrl(dataUrl);
    } catch (err) {
      setFieldErrors((p) => ({
        ...p,
        logoDataUrl: err instanceof Error ? err.message : "Invalid image file.",
      }));
    }
  };

  const handleSaveSection = async (e: FormEvent, section: SettingsTab) => {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setSaveFeedback(null);

    const payload =
      section === "invoice"
        ? {
            section: "invoice",
            name,
            logoDataUrl,
            address,
            gstin,
            phone,
            contactEmail,
            invoicePrefix,
            nextNumberInput,
            defaultGstRate,
            defaultDueDays,
            defaultNotes,
            defaultTerms,
          }
        : section === "payment"
          ? {
              section: "payment",
              razorpayKeyId,
              razorpayKeySecret,
              razorpayWebhookSecret,
            }
          : {
              section: "email",
              smtpHost,
              smtpPort,
              smtpSecure,
              smtpEmail,
              smtpPassword,
              emailSubjectTemplate,
              emailBodyTemplate,
            };

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        business?: BusinessPublicDTO;
        error?: string;
        fieldErrors?: FieldErrors;
      };
      if (!res.ok || !json.business) {
        if (json.fieldErrors) setFieldErrors(json.fieldErrors);
        throw new Error(json.error ?? "Could not save settings.");
      }

      applyBusinessToState(json.business);
      setSaveFeedback({
        variant: "success",
        message: "Settings saved. Secrets are encrypted and never shown again.",
      });
    } catch (err) {
      setSaveFeedback({
        variant: "error",
        message: err instanceof Error ? err.message : "Could not save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCheckRazorpay = async () => {
    setCheckingRzp(true);
    setRzpCheckStatus(null);
    try {
      const res = await fetch("/api/settings/razorpay-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyId: razorpayKeyId,
          keySecret: razorpayKeySecret,
        }),
      });
      const json = (await res.json()) as { ok: boolean; message: string };
      setRzpCheckStatus({ ok: json.ok, message: json.message });
    } catch (err) {
      setRzpCheckStatus({
        ok: false,
        message: err instanceof Error ? err.message : "Could not test Razorpay connection.",
      });
    } finally {
      setCheckingRzp(false);
    }
  };

  const handleDisconnectRazorpay = async () => {
    setSaving(true);
    setSaveFeedback(null);
    setRzpCheckStatus(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "payment", clearRazorpay: true }),
      });
      const json = (await res.json()) as { business?: BusinessPublicDTO; error?: string };
      if (!res.ok || !json.business) throw new Error(json.error ?? "Failed to disconnect.");
      applyBusinessToState(json.business);
      setSaveFeedback({
        variant: "success",
        message: "Razorpay disconnected. Public invoice links will hide the Pay button.",
      });
    } catch (err) {
      setSaveFeedback({
        variant: "error",
        message: err instanceof Error ? err.message : "Could not disconnect Razorpay.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    setEmailTestStatus(null);
    try {
      const res = await fetch("/api/settings/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: testRecipient || smtpEmail,
          smtpHost,
          smtpPort,
          smtpSecure,
          smtpEmail,
          smtpPassword,
        }),
      });
      const json = (await res.json()) as { ok: boolean; message: string };
      setEmailTestStatus({ ok: json.ok, message: json.message });
    } catch (err) {
      setEmailTestStatus({
        ok: false,
        message: err instanceof Error ? err.message : "Could not send test email.",
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading settings..." />
      </div>
    );
  }

  if (loadError || !business) {
    return (
      <Alert variant="error" title="Could not load settings">
        <p>{loadError ?? "Missing business data."}</p>
        <button
          type="button"
          onClick={() => void loadSettings()}
          className="mt-2 text-xs font-semibold underline"
        >
          Try again
        </button>
      </Alert>
    );
  }

  const previewNextNum = /^\d{1,8}$/.test(nextNumberInput.trim())
    ? formatInvoiceNumber(
        invoicePrefix,
        Number.parseInt(nextNumberInput.trim(), 10) || 1,
        nextNumberInput.trim().length
      )
    : `${invoicePrefix}0001`;

  const webhookUrl = origin ? `${origin}/api/webhooks/razorpay/${business.id}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Business Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure your invoice branding, Razorpay Test Mode account, and sender email.
        </p>
      </div>

      {/* Tab selector */}
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex flex-wrap gap-2 border-b border-slate-200 pb-3"
      >
        {[
          { id: "invoice" as const, label: "Invoice Settings", Icon: FileText },
          { id: "payment" as const, label: "Payment (Razorpay)", Icon: CreditCard },
          { id: "email" as const, label: "Email Settings", Icon: Mail },
        ].map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(id);
                setSaveFeedback(null);
                setFieldErrors({});
              }}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-blue-700 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {saveFeedback ? (
        <Alert variant={saveFeedback.variant}>{saveFeedback.message}</Alert>
      ) : null}

      {tab === "invoice" ? (
        <Card className="p-5 sm:p-6">
          <form onSubmit={(e) => void handleSaveSection(e, "invoice")} noValidate className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Business details on invoices</h2>
              <p className="mt-1 text-xs text-slate-500">
                New invoices follow these settings. Invoices already sent keep what they showed when sent.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2">
                {logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoDataUrl}
                    alt={`${name} logo`}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400">No logo</span>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="logo-upload" className="block text-sm font-medium text-slate-800">
                  Business logo (PNG, JPEG, or WebP)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void handleLogoFileChange(e)}
                    className="block max-w-xs text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {logoDataUrl ? (
                    <button
                      type="button"
                      onClick={() => setLogoDataUrl(null)}
                      className="text-xs font-medium text-rose-700 hover:underline"
                    >
                      Remove logo
                    </button>
                  ) : null}
                </div>
                {fieldErrors.logoDataUrl ? (
                  <p className="text-xs font-medium text-rose-700">{fieldErrors.logoDataUrl}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="biz-name" label="Business name" error={fieldErrors.name} required>
                <input
                  id="biz-name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={inputClassName}
                />
              </Field>

              <Field
                id="biz-gstin"
                label="GSTIN"
                hint="15-character GST number (optional)."
                error={fieldErrors.gstin}
              >
                <input
                  id="biz-gstin"
                  name="gstin"
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  aria-invalid={Boolean(fieldErrors.gstin)}
                  className={inputClassName}
                  placeholder="27ABCDE1234F1Z5"
                />
              </Field>

              <Field id="biz-phone" label="Business phone" error={fieldErrors.phone}>
                <input
                  id="biz-phone"
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClassName}
                  placeholder="+91 98765 43210"
                />
              </Field>

              <Field id="biz-email" label="Business email" error={fieldErrors.contactEmail}>
                <input
                  id="biz-email"
                  name="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.contactEmail)}
                  className={inputClassName}
                  placeholder="billing@yourbusiness.com"
                />
              </Field>
            </div>

            <Field id="biz-address" label="Business address" error={fieldErrors.address}>
              <textarea
                id="biz-address"
                name="address"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClassName}
                placeholder="12 Anna Salai, Chennai, Tamil Nadu 600002"
              />
            </Field>

            <div className="border-t border-slate-200 pt-5">
              <h3 className="text-base font-semibold text-slate-900">Number format & defaults</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  id="inv-prefix"
                  label="Number prefix"
                  hint="e.g. INV- or ABC/26-27/"
                  error={fieldErrors.invoicePrefix}
                  required
                >
                  <input
                    id="inv-prefix"
                    name="invoicePrefix"
                    type="text"
                    required
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.invoicePrefix)}
                    className={inputClassName}
                  />
                </Field>

                <Field
                  id="inv-next"
                  label="Next number"
                  hint={`Preview: ${previewNextNum}`}
                  error={fieldErrors.nextNumberInput}
                  required
                >
                  <input
                    id="inv-next"
                    name="nextNumberInput"
                    type="text"
                    inputMode="numeric"
                    required
                    value={nextNumberInput}
                    onChange={(e) => setNextNumberInput(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.nextNumberInput)}
                    className={inputClassName}
                  />
                </Field>

                <Field
                  id="def-gst"
                  label="Default GST (%)"
                  error={fieldErrors.defaultGstRate}
                  required
                >
                  <input
                    id="def-gst"
                    name="defaultGstRate"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    required
                    value={defaultGstRate}
                    onChange={(e) => setDefaultGstRate(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.defaultGstRate)}
                    className={inputClassName}
                  />
                </Field>

                <Field
                  id="def-due"
                  label="Default due days"
                  hint="Days after invoice date"
                  error={fieldErrors.defaultDueDays}
                  required
                >
                  <input
                    id="def-due"
                    name="defaultDueDays"
                    type="number"
                    min={0}
                    max={365}
                    step="1"
                    required
                    value={defaultDueDays}
                    onChange={(e) => setDefaultDueDays(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.defaultDueDays)}
                    className={inputClassName}
                  />
                </Field>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="def-notes"
                label="Default notes (shown at bottom of invoice)"
                hint="For example: bank account / UPI details."
              >
                <textarea
                  id="def-notes"
                  name="defaultNotes"
                  rows={3}
                  value={defaultNotes}
                  onChange={(e) => setDefaultNotes(e.target.value)}
                  className={inputClassName}
                  placeholder="Bank: HDFC Bank • A/C: 1234567890 • IFSC: HDFC0000123"
                />
              </Field>

              <Field id="def-terms" label="Default terms & conditions">
                <textarea
                  id="def-terms"
                  name="defaultTerms"
                  rows={3}
                  value={defaultTerms}
                  onChange={(e) => setDefaultTerms(e.target.value)}
                  className={inputClassName}
                  placeholder="Please pay on or before the due date."
                />
              </Field>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className={primaryButtonClassName}>
                {saving ? "Saving..." : "Save invoice settings"}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {tab === "payment" ? (
        <Card className="p-5 sm:p-6">
          <form onSubmit={(e) => void handleSaveSection(e, "payment")} noValidate className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Razorpay Test Mode</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Connect your own Razorpay account so customers see a Pay button and funds settle to your account.
                </p>
              </div>
              {business.razorpayKeyId && business.hasRazorpaySecret ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Not connected (no Pay button on public links)
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="rzp-key-id"
                label="Razorpay Key ID"
                hint="Starts with rzp_test_"
                error={fieldErrors.razorpayKeyId}
                required
              >
                <input
                  id="rzp-key-id"
                  name="razorpayKeyId"
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={razorpayKeyId}
                  onChange={(e) => setRazorpayKeyId(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.razorpayKeyId)}
                  className={inputClassName}
                  placeholder="rzp_test_xxxxxxxxxxxxxx"
                />
              </Field>

              <Field
                id="rzp-key-secret"
                label="Razorpay Key Secret"
                hint={
                  business.hasRazorpaySecret
                    ? "Saved securely (hidden). Leave blank to keep the saved secret."
                    : "Encrypted before saving and never shown again."
                }
                error={fieldErrors.razorpayKeySecret}
                required={!business.hasRazorpaySecret}
              >
                <input
                  id="rzp-key-secret"
                  name="razorpayKeySecret"
                  type="password"
                  autoComplete="new-password"
                  value={razorpayKeySecret}
                  onChange={(e) => setRazorpayKeySecret(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.razorpayKeySecret)}
                  className={inputClassName}
                  placeholder={business.hasRazorpaySecret ? "••••••••••••••••" : "Enter Key Secret"}
                />
              </Field>
            </div>

            <Field
              id="rzp-webhook-secret"
              label="Razorpay Webhook Secret"
              hint={
                business.hasRazorpayWebhookSecret
                  ? "Saved securely (hidden). Leave blank to keep your existing webhook secret."
                  : "Set a secret in Razorpay Dashboard → Webhooks and paste it here."
              }
              error={fieldErrors.razorpayWebhookSecret}
            >
              <input
                id="rzp-webhook-secret"
                name="razorpayWebhookSecret"
                type="password"
                autoComplete="new-password"
                value={razorpayWebhookSecret}
                onChange={(e) => setRazorpayWebhookSecret(e.target.value)}
                className={inputClassName}
                placeholder={
                  business.hasRazorpayWebhookSecret
                    ? "••••••••••••••••"
                    : "Enter webhook secret"
                }
              />
            </Field>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold tracking-wider text-slate-600 uppercase">
                Your Razorpay Webhook URL
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Add this URL in Razorpay Dashboard (Test Mode) → Account &amp; Settings → Webhooks
                for events <code>payment.captured</code> and <code>order.paid</code>:
              </p>
              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800">
                  {webhookUrl || "/api/webhooks/razorpay/..."}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    if (!webhookUrl) return;
                    await navigator.clipboard.writeText(webhookUrl);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                  className={secondaryButtonClassName}
                >
                  {copiedWebhook ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {rzpCheckStatus ? (
              <Alert variant={rzpCheckStatus.ok ? "success" : "error"}>
                {rzpCheckStatus.message}
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={checkingRzp}
                  onClick={() => void handleCheckRazorpay()}
                  className={secondaryButtonClassName}
                >
                  {checkingRzp ? "Checking..." : "Check connection"}
                </button>
                {business.razorpayKeyId ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDisconnectRazorpay()}
                    className="rounded-xl border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                  >
                    Disconnect
                  </button>
                ) : null}
              </div>

              <button type="submit" disabled={saving} className={primaryButtonClassName}>
                {saving ? "Saving..." : "Save payment settings"}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {tab === "email" ? (
        <Card className="p-5 sm:p-6">
          <form onSubmit={(e) => void handleSaveSection(e, "email")} noValidate className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Your business email account</h2>
              <p className="mt-1 text-xs text-slate-500">
                Invoices are emailed directly from your own account (for Gmail, use your email and a
                16-character Google App Password).
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="smtp-host" label="SMTP host" error={fieldErrors.smtpHost} required>
                <input
                  id="smtp-host"
                  name="smtpHost"
                  type="text"
                  required
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field id="smtp-port" label="SMTP port" error={fieldErrors.smtpPort} required>
                <input
                  id="smtp-port"
                  name="smtpPort"
                  type="number"
                  required
                  value={smtpPort}
                  onChange={(e) => {
                    setSmtpPort(e.target.value);
                    setSmtpSecure(e.target.value === "465");
                  }}
                  className={inputClassName}
                />
              </Field>

              <div className="flex items-end pb-2">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-blue-700"
                  />
                  <span>Use SSL/TLS (port 465)</span>
                </label>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="smtp-email" label="Sender email address" error={fieldErrors.smtpEmail} required>
                <input
                  id="smtp-email"
                  name="smtpEmail"
                  type="email"
                  autoComplete="email"
                  value={smtpEmail}
                  onChange={(e) => setSmtpEmail(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.smtpEmail)}
                  className={inputClassName}
                  placeholder="you@gmail.com"
                />
              </Field>

              <Field
                id="smtp-password"
                label="App Password"
                hint={
                  business.hasSmtpPassword
                    ? "Saved securely (hidden). Leave blank to keep your saved password."
                    : "Encrypted before saving and never shown again."
                }
                error={fieldErrors.smtpPassword}
                required={!business.hasSmtpPassword}
              >
                <input
                  id="smtp-password"
                  name="smtpPassword"
                  type="password"
                  autoComplete="new-password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.smtpPassword)}
                  className={inputClassName}
                  placeholder={business.hasSmtpPassword ? "••••••••••••••••" : "16-character App Password"}
                />
              </Field>
            </div>

            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Invoice email template</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Click any placeholder to insert it into your message:
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SUPPORTED_EMAIL_PLACEHOLDERS.map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => setEmailBodyTemplate((prev) => `${prev}${prev.endsWith(" ") || prev.endsWith("\n") ? "" : " "}${token}`)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-800"
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              <Field
                id="email-subject"
                label="Email subject"
                error={fieldErrors.emailSubjectTemplate}
                required
              >
                <input
                  id="email-subject"
                  name="emailSubjectTemplate"
                  type="text"
                  required
                  value={emailSubjectTemplate}
                  onChange={(e) => setEmailSubjectTemplate(e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field
                id="email-body"
                label="Email message"
                error={fieldErrors.emailBodyTemplate}
                required
              >
                <textarea
                  id="email-body"
                  name="emailBodyTemplate"
                  rows={6}
                  required
                  value={emailBodyTemplate}
                  onChange={(e) => setEmailBodyTemplate(e.target.value)}
                  className={inputClassName}
                />
              </Field>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-semibold tracking-wider text-slate-600 uppercase">
                Verify email delivery
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  aria-label="Test email recipient"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="your-test-address@gmail.com"
                  className={`${inputClassName} flex-1`}
                />
                <button
                  type="button"
                  disabled={sendingTestEmail}
                  onClick={() => void handleSendTestEmail()}
                  className={secondaryButtonClassName}
                >
                  {sendingTestEmail ? "Sending test..." : "Send test email"}
                </button>
              </div>
              {emailTestStatus ? (
                <Alert variant={emailTestStatus.ok ? "success" : "error"}>
                  {emailTestStatus.message}
                </Alert>
              ) : null}
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className={primaryButtonClassName}>
                {saving ? "Saving..." : "Save email settings"}
              </button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
