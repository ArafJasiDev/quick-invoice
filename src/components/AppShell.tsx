"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  Users,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", Icon: FileText },
  { href: "/customers", label: "Customers", Icon: Users },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export function AppShell({
  businessName,
  userEmail,
  children,
}: {
  businessName: string;
  userEmail: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/dashboard"
              className="flex min-w-0 items-center gap-2.5 rounded-lg py-1 font-bold text-slate-900"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold text-white">
                QI
              </span>
              <span className="truncate text-base tracking-tight">{businessName}</span>
            </Link>
          </div>

          {/* Desktop primary nav */}
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map(({ href, label, Icon }) => {
              const active =
                pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-800"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/invoices/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">New Invoice</span>
              <span className="sm:hidden">New</span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              title={`Sign out (${userEmail})`}
              className="hidden items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 md:inline-flex"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{signingOut ? "Signing out..." : "Sign out"}</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 md:hidden"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <nav
            id="mobile-nav-drawer"
            aria-label="Mobile navigation"
            className="border-t border-slate-200 bg-white px-4 py-3 md:hidden"
          >
            <div className="mb-2 border-b border-slate-100 pb-2 text-xs text-slate-500">
              Signed in as <span className="font-medium text-slate-700">{userEmail}</span>
            </div>
            <ul className="space-y-1">
              {NAV_ITEMS.map(({ href, label, Icon }) => {
                const active =
                  pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                        active
                          ? "bg-blue-50 text-blue-800"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}
              <li className="pt-1">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>{signingOut ? "Signing out..." : "Sign out"}</span>
                </button>
              </li>
            </ul>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
