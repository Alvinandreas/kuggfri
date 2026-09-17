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
