import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Beslutet om åtkomst till /admin. Ren funktion så att den kan testas och
 * användas identiskt i middleware och i admin-layouten.
 *
 * In släpps admin (profiles.is_admin) och examinatorer (minst en rad i
 * deck_examiners). Vad examinatorn sedan får se avgörs per deck av RLS och
 * av lib/admin/access.ts.
 */
export type AdminAccessDecision = { kind: "redirect-login" } | { kind: "forbidden" } | { kind: "ok" };

export function decideAdminAccess(
  user: { id: string } | null,
  profile: { is_admin: boolean } | null | undefined,
  examinerDeckCount = 0,
): AdminAccessDecision {
  if (!user) return { kind: "redirect-login" };
  if (profile?.is_admin === true) return { kind: "ok" };
  if (examinerDeckCount > 0) return { kind: "ok" };
  return { kind: "forbidden" };
}

/** Det som avgör åtkomsten till /admin: profilens adminflagga och kurserna man är examinator för. */
export type AdminFacts = { profile: { is_admin: boolean } | null; examinerDeckIds: string[] };

/** Kurserna användaren är examinator för (deck_examiners). Tom lista även när uppslaget misslyckas. */
export async function loadExaminerDeckIds(supabase: SupabaseClient<Database>, userId: string): Promise<string[]> {
  const { data } = await supabase.from("deck_examiners").select("deck_id").eq("user_id", userId);
  return (data ?? []).map((r) => r.deck_id);
}

/**
 * Admin- och examinatorsuppslaget för en inloggad användare. Examinatorskapet slås bara upp
 * för den som inte är admin (admin får ändå allt). Används av middleware; lib/admin/access.ts
 * har redan profilen och använder loadExaminerDeckIds direkt.
 */
export async function loadAdminFacts(supabase: SupabaseClient<Database>, userId: string): Promise<AdminFacts> {
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  const examinerDeckIds = profile?.is_admin ? [] : await loadExaminerDeckIds(supabase, userId);
  return { profile, examinerDeckIds };
}

/** Sätter innehållspolicyn (CSP) på ett svar från middleware och returnerar svaret. */
export function withCsp<T extends NextResponse>(res: T, csp: string): T {
  res.headers.set("content-security-policy", csp);
  return res;
}
