import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * Supabase-klient med service role: går förbi RLS och har ingen session. Bara för servern
 * (cron-jobbet, tentabanken) och bara där anroparen själv avgör vem som får se vad.
 * Null när SUPABASE_SERVICE_ROLE_KEY saknas; anroparen bestämmer hur det ska märkas.
 */
export function createServiceRoleClient(): SupabaseClient<Database> | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const { url } = getSupabaseEnv();
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
