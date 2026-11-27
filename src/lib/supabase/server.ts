import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { BusinessRow } from "./mappers";

function getSupabaseUrlAndAnon(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }
  return { url, anonKey };
}

export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseUrlAndAnon();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies during render; middleware handles refresh.
        }
      },
    },
  });
}

export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getAuthenticatedBusiness(): Promise<{
  supabase: SupabaseClient;
  userId: string;
  userEmail: string;
  business: BusinessRow;
} | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: existing, error: fetchError } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Could not load business profile: ${fetchError.message}`);
  }

  if (existing) {
    return {
      supabase,
      userId: user.id,
      userEmail: user.email ?? "",
      business: existing as BusinessRow,
    };
  }

  // Fallback creation if trigger didn't run
  const metaName =
    typeof user.user_metadata?.business_name === "string"
      ? user.user_metadata.business_name.trim()
      : "";
  const fallbackName = metaName || (user.email ? user.email.split("@")[0] ?? "My Business" : "My Business");

  const { data: created, error: createError } = await supabase
    .from("businesses")
    .insert({
      owner_user_id: user.id,
      name: fallbackName,
      contact_email: user.email ?? "",
    })
    .select("*")
    .single();

  if (createError || !created) {
    throw new Error(`Could not initialize business profile: ${createError?.message ?? "unknown"}`);
  }

  return {
    supabase,
    userId: user.id,
    userEmail: user.email ?? "",
    business: created as BusinessRow,
  };
}
