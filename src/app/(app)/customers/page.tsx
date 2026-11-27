"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  Spinner,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui";
import type { CustomerDTO } from "@/lib/types";
import { validateCustomerInput, type FieldErrors } from "@/lib/validation";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<"name" | "email" | "phone">>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customers", { cache: "no-store" });
      const json = (await res.json()) as { customers?: CustomerDTO[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not load customers.");
      setCustomers(json.customers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const openCreateForm = () => {
    setEditingId(null);
    setName("");
    setEmail("");
    setPhone("");
    setFieldErrors({});
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (cust: CustomerDTO) => {
    setEditingId(cust.id);
    setName(cust.name);
    setEmail(cust.email);
    setPhone(cust.phone);
    setFieldErrors({});
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setBanner(null);

    const errs = validateCustomerInput({ name, email, phone });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const endpoint = editingId ? `/api/customers/${editingId}` : "/api/customers";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() }),
      });
      const json = (await res.json()) as {
        customer?: CustomerDTO;
        error?: string;
        fieldErrors?: FieldErrors<"name" | "email" | "phone">;
      };

      if (!res.ok) {
        if (json.fieldErrors) setFieldErrors(json.fieldErrors);
        throw new Error(json.error ?? "Could not save customer.");
      }

      setShowForm(false);
      setBanner(editingId ? "Customer updated." : "Customer added.");
      await loadCustomers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save customer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cust: CustomerDTO) => {
    setBanner(null);
    setError(null);
    const res = await fetch(`/api/customers/${cust.id}`, { method: "DELETE" });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not delete customer.");
      return;
    }
    setBanner(`Removed ${cust.name}.`);
    await loadCustomers();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Save customer contact details for quick invoicing.
          </p>
        </div>
        {!showForm ? (
          <button type="button" onClick={openCreateForm} className={primaryButtonClassName}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Customer</span>
          </button>
        ) : null}
      </div>

      {banner ? <Alert variant="success">{banner}</Alert> : null}

      {showForm ? (
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingId ? "Edit customer" : "Add new customer"}
          </h2>
          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            {formError ? <Alert variant="error">{formError}</Alert> : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="cust-name" label="Customer name" error={fieldErrors.name} required>
                <input
                  id="cust-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                  }}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "cust-name-error" : undefined}
                  className={inputClassName}
                  placeholder="Asha Traders"
                />
              </Field>

              <Field id="cust-email" label="Email address" error={fieldErrors.email} required>
                <input
                  id="cust-email"
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
                  aria-describedby={fieldErrors.email ? "cust-email-error" : undefined}
                  className={inputClassName}
                  placeholder="accounts@asha.in"
                />
              </Field>

              <Field id="cust-phone" label="Phone number" error={fieldErrors.phone}>
                <input
                  id="cust-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
                  }}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? "cust-phone-error" : undefined}
                  className={inputClassName}
                  placeholder="+91 98765 43210"
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button type="submit" disabled={saving} className={primaryButtonClassName}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Save customer"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className={secondaryButtonClassName}
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="p-4 sm:p-5">
        {error ? (
          <Alert variant="error" title="Customer error">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadCustomers()}
              className="mt-2 text-xs font-semibold underline"
            >
              Reload customers
            </button>
          </Alert>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Spinner label="Loading customers..." />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers yet"
            description="Add your first customer with their name, email, and phone so you can send them invoices."
            action={
              <button type="button" onClick={openCreateForm} className={primaryButtonClassName}>
                <Users className="h-4 w-4" aria-hidden="true" />
                <span>Add your first customer</span>
              </button>
            }
          />
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="space-y-3 sm:hidden">
              {customers.map((cust) => (
                <li
                  key={cust.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{cust.name}</p>
                      <p className="truncate text-sm text-slate-600">{cust.email}</p>
                      {cust.phone ? (
                        <p className="mt-0.5 text-xs text-slate-500">{cust.phone}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(cust)}
                        aria-label={`Edit ${cust.name}`}
                        className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(cust)}
                        aria-label={`Delete ${cust.name}`}
                        className="rounded-lg border border-slate-200 p-2 text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div tabIndex={0} role="region" aria-label="Customers list" className="qi-table-wrap hidden sm:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Phone</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-slate-50">
                      <td className="py-3.5 pr-4 font-semibold text-slate-900">{cust.name}</td>
                      <td className="py-3.5 pr-4 text-slate-700">{cust.email}</td>
                      <td className="py-3.5 pr-4 text-slate-600">{cust.phone || "—"}</td>
                      <td className="py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(cust)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(cust)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
