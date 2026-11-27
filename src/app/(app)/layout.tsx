import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getAuthenticatedBusiness } from "@/lib/supabase/server";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const auth = await getAuthenticatedBusiness();
  if (!auth) {
    redirect("/login");
  }

  return (
    <AppShell businessName={auth.business.name} userEmail={auth.userEmail}>
      {children}
    </AppShell>
  );
}
