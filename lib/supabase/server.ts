import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * Supabase-klient för Server Components, Server Actions och Route Handlers.
 * Läser och (där det går) skriver sessionskakor.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Anropat från en Server Component: kakor kan inte sättas här.
          // Middleware uppdaterar sessionen i stället.
        }
      },
    },
  });
}

/**
 * Inloggad användare eller null. Memoiserad per request (layout, header och
 * sida delar ett enda anrop). Sväljer konfigurationsfel så att sidor kan
 * renderas som gäst.
 */
export const getCurrentUser = cache(async () => {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});

/** Användaren och profilen, eller null om utloggad. Memoiserad per request. */
export const getCurrentProfile = cache(async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const supabase = await createSupabaseServerClient();
    // Bara det appen faktiskt läser: körs på varje sidvisning för inloggade.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, is_admin, reminder_email, digest_email, created_at")
      .eq("id", user.id)
      .maybeSingle();
    return { user, profile };
  } catch {
    return null;
  }
});
