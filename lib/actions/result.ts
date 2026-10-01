import "server-only";
import type { Dict } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";

/**
 * Serveråtgärdernas gemensamma resultat och indatakontroller. Ligger utanför "use server"-
 * modulerna eftersom en sådan bara får exportera async-funktioner, och eftersom de här inte
 * ska kunna anropas från klienten.
 */

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function tooLong(sv: Dict, field: string, value: string, max: number): ActionResult<never> | null {
  return value.length > max ? { ok: false, error: sv.admin.tooLong(field, max) } : null;
}

/**
 * Ett kastat fel som resultat: "forbidden" blir behörighetstexten, allt annat det allmänna felet.
 * Async för att texten ska följa förfrågans språk; `return fail(e)` i en async-funktion fungerar
 * som förut.
 */
export async function fail(error: unknown): Promise<ActionResult<never>> {
  const sv = await getT();
  const message = error instanceof Error ? error.message : String(error);
  if (message === "forbidden") return { ok: false, error: sv.common.forbiddenBody };
  return { ok: false, error: sv.errors.generic };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rensar en lista id:n från klienten: bara uuid:er, inga dubbletter, högst max stycken. */
export function cleanIds(ids: unknown, max: number): string[] | null {
  if (!Array.isArray(ids)) return null;
  const valid = ids.filter((id): id is string => typeof id === "string" && UUID_RE.test(id));
  if (valid.length !== ids.length) return null;
  const out = [...new Set(valid)];
  return out.length > max ? null : out;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
