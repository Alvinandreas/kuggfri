/**
 * Beslutet om åtkomst till /admin. Ren funktion så att den kan testas och
 * användas identiskt i middleware och i admin-layouten.
 */
export type AdminAccessDecision = { kind: "redirect-login" } | { kind: "forbidden" } | { kind: "ok" };

export function decideAdminAccess(
  user: { id: string } | null,
  profile: { is_admin: boolean } | null | undefined,
): AdminAccessDecision {
  if (!user) return { kind: "redirect-login" };
  if (profile?.is_admin !== true) return { kind: "forbidden" };
  return { kind: "ok" };
}
