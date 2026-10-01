import "server-only";

/**
 * Gemensamma delar för serveråtgärderna, kvar under det gamla namnet så att befintliga
 * importer fungerar. Delarna bor i lib/actions/result.ts (resultat och indatakontroller),
 * lib/actions/guard.ts (åtkomst och felhantering) och lib/cache/revalidate.ts (cachen).
 */

export { cleanIds, fail, isUuid, tooLong, type ActionResult } from "@/lib/actions/result";
export { requireAdmin, requireEditor } from "@/lib/actions/guard";
export { revalidateDeck } from "@/lib/cache/revalidate";
