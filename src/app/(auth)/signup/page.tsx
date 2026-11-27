"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  Alert,
  Card,
  Field,
  inputClassName,
  primaryButtonClassName,
} from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isValidEmail } from "@/lib/validation";

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    businessName?: string;
    email?: string;
    password?: string;
  }>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMessage(null);

    const nextErrors: { businessName?: string; email?: string; password?: string } = {};
    if (!businessName.trim()) {
      nextErrors.businessName = "Enter your business name.";
    }
    if (!email.trim()) {
      nextErrors.email = "Enter an email address.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Enter an email address in the format you@example.com.";
    }
    if (!password) {
      nextErrors.password = "Choose a password.";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters long.";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            business_name: businessName.trim(),
          },
        },
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setInfoMessage(
          "Account created! Check your email inbox to confirm your address, then sign in."
        );
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold text-white">
              QI
            </span>
            <span className="text-xl tracking-tight">Quick Invoice</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Create your business account</h1>
          <p className="mt-1 text-sm text-slate-600">
            Each business has its own isolated customers, invoices, and settings.
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {formError ? <Alert variant="error">{formError}</Alert> : null}
            {infoMessage ? <Alert variant="success">{infoMessage}</Alert> : null}

            <Field
              id="businessName"
              label="Business name"
              error={fieldErrors.businessName}
              required
            >
              <input
                id="businessName"
                name="businessName"
                type="text"
                autoComplete="organization"
                required
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  if (fieldErrors.businessName) {
                    setFieldErrors((p) => ({ ...p, businessName: undefined }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.businessName)}
                aria-describedby={fieldErrors.businessName ? "businessName-error" : undefined}
                className={inputClassName}
                placeholder="Magizh Design Studio"
              />
            </Field>

            <Field id="email" label="Email address" error={fieldErrors.email} required>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                className={inputClassName}
                placeholder="owner@yourbusiness.com"
              />
            </Field>

            <Field
              id="password"
              label="Password"
              hint="Minimum 8 characters."
              error={fieldErrors.password}
              required
            >
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password ? "password-hint password-error" : "password-hint"
                  }
                  className={`${inputClassName} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-1 flex items-center rounded-lg px-2.5 text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </Field>

            <button
              type="submit"
              disabled={submitting}
              className={`${primaryButtonClassName} w-full`}
            >
              {submitting ? "Creating account..." : "Create business account"}
            </button>
          </form>
        </Card>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-blue-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
