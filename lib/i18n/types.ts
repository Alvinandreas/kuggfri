/**
 * Ordlistornas typ. Den svenska ordlistan (lib/i18n/sv.ts) är förlagan; den engelska
 * (lib/i18n/en.ts) måste ha exakt samma nycklar och funktioner, men andra texter. DeepWiden gör
 * de svenska strängliteralerna (as const) till string, så att typen säger "en text här" och inte
 * "just den här svenska texten".
 */
import type { sv } from "./sv";

type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : T extends object
        ? { readonly [K in keyof T]: Widen<T[K]> }
        : T;

export type Dict = Widen<typeof sv>;

export type Lang = "sv" | "en";

export const LANGS: readonly Lang[] = ["sv", "en"];

/** Cookien som bär språkvalet. Sätts bara av reglaget English (admin och examinatorer). */
export const LANG_COOKIE = "kuggfri-sprak";

export function isLang(value: unknown): value is Lang {
  return value === "sv" || value === "en";
}
