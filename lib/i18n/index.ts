/**
 * Ordlistorna. Svenska är standard för alla; engelska visas bara för den som slagit på reglaget
 * English, valt av var och en under Konto → Språk (profiles.lang).
 *
 * - Serverkomponenter, serveråtgärder och routes: `const sv = await getT()` (lib/i18n/server).
 * - Klientkomponenter: `const sv = useT()` (lib/i18n/client).
 * Namnet `sv` på den lokala variabeln är kvar av historiska skäl: det är ordlistan i det valda
 * språket.
 */
import { en } from "./en";
import { sv } from "./sv";
import type { Dict, Lang } from "./types";

export type { Dict, Lang } from "./types";
export { isLang } from "./types";

export function dictionary(lang: Lang): Dict {
  return lang === "en" ? en : sv;
}
