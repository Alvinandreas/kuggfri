/**
 * Ren logik för kortredigeraren: från formulärets fält till det som sparas (typ och
 * alternativ), och samma normalisering på servern. Servern är sanningen; klienten kör
 * samma funktioner för att kunna visa felen direkt.
 */
import { isAutoGraded, isCardKind, parseOptions, trueFalseAnswer, trueFalseOptions, validateKind, type CardKind, type CardOption } from "@/lib/cards/kinds";
import { LIMITS } from "@/lib/admin/limits";

/** Ett alternativ i redigeraren. key håller React-listan stabil när raderna flyttas. */
export type OptionDraft = { key: string; text: string; correct: boolean };

let seq = 0;
export function newOptionKey(): string {
  seq += 1;
  return `alt-${seq}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Alternativen att börja redigera med: kortets egna, annars två tomma rader. */
export function initialAlternatives(kind: CardKind, options: readonly CardOption[] | null): OptionDraft[] {
  if (kind === "alternativ" && options && options.length > 0) return options.map((o) => ({ key: newOptionKey(), text: o.text, correct: o.correct }));
  return [
    { key: newOptionKey(), text: "", correct: true },
    { key: newOptionKey(), text: "", correct: false },
  ];
}

/** Sant/Falskt-svaret att börja med: kortets eget, annars inget val. */
export function initialTrueFalse(kind: CardKind, options: readonly CardOption[] | null): boolean | null {
  return kind === "sant-falskt" ? trueFalseAnswer(options) : null;
}

/**
 * Det som sparas i options för en viss typ. Vändkort: null. Sant/Falskt: de två fasta
 * alternativen (null om inget svar är valt, så att valideringen säger till). Alternativ:
 * raderna som de står, med trimmad text.
 */
export function buildOptions(kind: CardKind, alternatives: readonly Pick<OptionDraft, "text" | "correct">[], trueFalse: boolean | null): CardOption[] | null {
  if (!isAutoGraded(kind)) return null;
  if (kind === "sant-falskt") return trueFalse === null ? null : trueFalseOptions(trueFalse);
  return alternatives.map((a) => ({ text: a.text.trim(), correct: a.correct }));
}

/** Flyttar ett element ett steg upp (-1) eller ner (1). Utanför listan: oförändrad kopia. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item!);
  return next;
}

/**
 * Tolkar och kontrollerar typ och alternativ från klienten. Används av serveråtgärderna,
 * så att ogiltiga kombinationer aldrig når databasen (vars check-villkor är grövre).
 */
export function normalizeKindInput(kindRaw: unknown, optionsRaw: unknown): { ok: true; kind: CardKind; options: CardOption[] | null } | { ok: false; error: string } {
  if (!isCardKind(kindRaw)) return { ok: false, error: "Okänd uppgiftstyp." };
  const kind = kindRaw;
  if (!isAutoGraded(kind)) return { ok: true, kind, options: null };
  const parsed = optionsRaw === null || optionsRaw === undefined ? null : parseOptions(optionsRaw);
  if (optionsRaw !== null && optionsRaw !== undefined && parsed === null) return { ok: false, error: "Svarsalternativen har fel form." };
  const options = parsed?.map((o) => ({ text: o.text.trim(), correct: o.correct })) ?? null;
  if (options && options.length > LIMITS.maxOptions) return { ok: false, error: `Högst ${LIMITS.maxOptions} alternativ.` };
  if (options?.some((o) => o.text.length > LIMITS.optionText)) return { ok: false, error: `Ett alternativ får vara högst ${LIMITS.optionText} tecken.` };
  const issues = validateKind(kind, options);
  if (issues.length > 0) return { ok: false, error: issues.join(" ") };
  return { ok: true, kind, options };
}

/**
 * Ny ordning för hela listan när bara en filtrerad del av den har sorterats om: de synliga
 * korten tar de platser de synliga korten hade, i sin nya ordning; resten står kvar.
 */
export function mergeSubsetOrder(allIds: readonly string[], reorderedSubset: readonly string[]): string[] {
  const subset = new Set(reorderedSubset);
  let next = 0;
  return allIds.map((id) => (subset.has(id) ? (reorderedSubset[next++] ?? id) : id));
}
