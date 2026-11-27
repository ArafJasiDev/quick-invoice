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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      nextErrors.email = "Enter your business email address.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Enter an email address in the format you@example.com.";
    }
    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setFormError(
          error.message.includes("Invalid login")
            ? "Email or password did not match. Check your details and try again."
            : error.message
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not sign in.");
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
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Sign in to your business</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage customers, send GST invoices, and track payments.
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {formError ? <Alert variant="error">{formError}</Alert> : null}

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
                placeholder="billing@yourbusiness.com"
              />
            </Field>

            <Field id="password" label="Password" error={fieldErrors.password} required>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
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
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </Card>

        <p className="text-center text-sm text-slate-600">
          New business?{" "}
          <Link href="/signup" className="font-semibold text-blue-700 hover:underline">
            Create your account
          </Link>
        </p>
      </div>
    </div>
  );
}
