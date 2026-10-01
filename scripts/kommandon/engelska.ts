/**
 * `npm run kuggfri -- engelska <kurs> [--mal prod] [--ja]`: synkar de engelska översättningarna
 * (content/<kurs>/engelska.json) till cards.translation_en, categories.title_en och
 * decks.description_en. Se lib/cards/translation.ts.
 *
 * Översättningen är ett hjälpmedel för examinatorer som inte läser svenska; den ingår inte i
 * innehållets konfliktmodell och filen vinner alltid. Varningar: kort utan översättning, och
 * översättningar som gjordes av en äldre svensk text (fingeravtrycket stämmer inte längre). Samma
 * sak för flaggornas anteckningar (flag och flag_sv): en inaktuell översättning visas inte, utan
 * granskningen visar då den svenska anteckningen.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { deckId as deckIdFor, flattenCards } from "@/lib/content/model";
import { courseDir, loadCourse } from "@/lib/content/store";
import { flagFingerprint, swedishFingerprint, toStored, type TranslationFile } from "@/lib/cards/translation";
import { ROOT, type Args } from "../cli/args";
import { query, readTarget, sqlLiteral, targetName } from "../cli/db";
import { C, confirm, dim, fail, say } from "../cli/output";

export const TRANSLATION_FILE = "engelska.json";

export async function cmdEngelska(args: Args): Promise<void> {
  const key = args.positional[1];
  if (!key) fail("Ange kursen: npm run kuggfri -- engelska <kurs> [--mal prod]");
  const target = readTarget(args.flags);
  const path = join(courseDir(ROOT, key), TRANSLATION_FILE);
  if (!existsSync(path)) fail(`Hittar ingen översättning: ${path}`);
  const file = JSON.parse(readFileSync(path, "utf8")) as TranslationFile;
  const { course } = loadCourse(ROOT, key);

  const cards = flattenCards(course).map((f) => f.card);
  const known = new Set(cards.map((c) => c.key));
  const missing = cards.filter((c) => (c.active || c.review === "utkast") && !file.cards[c.key]);
  const stale = cards.filter((c) => file.cards[c.key] && file.cards[c.key]!.sv !== swedishFingerprint(c));
  const unknown = Object.keys(file.cards).filter((k) => !known.has(k));
  const flagged = cards.filter((c) => c.flag);
  const flagMissing = flagged.filter((c) => !file.cards[c.key]?.flag);
  const flagStale = flagged.filter((c) => file.cards[c.key]?.flag && file.cards[c.key]!.flag_sv !== flagFingerprint(c.flag!));
  const optionMismatch = cards.filter((c) => {
    const t = file.cards[c.key];
    return t && (t.options?.length ?? 0) !== (c.options?.length ?? 0);
  });

  say(`${C.bold}Engelska för ${key}${C.reset} mot ${targetName(target)}`);
  say(`  översatta kort: ${Object.keys(file.cards).length - unknown.length} av ${cards.length}, områden: ${Object.keys(file.areas).length}`);
  if (missing.length > 0) say(`${C.yellow}  Saknar översättning:${C.reset} ${missing.length} kort (${missing.slice(0, 5).map((c) => c.key).join(", ")}${missing.length > 5 ? " …" : ""})`);
  if (stale.length > 0) say(`${C.yellow}  Svenskan ändrad sedan översättningen:${C.reset} ${stale.length} kort (${stale.slice(0, 5).map((c) => c.key).join(", ")}${stale.length > 5 ? " …" : ""})`);
  if (optionMismatch.length > 0) say(`${C.yellow}  Fel antal alternativ:${C.reset} ${optionMismatch.map((c) => c.key).join(", ")}`);
  say(`  översatta flaggor: ${flagged.length - flagMissing.length} av ${flagged.length}`);
  if (flagMissing.length > 0) say(`${C.yellow}  Flaggor utan översättning:${C.reset} ${flagMissing.length} (${flagMissing.slice(0, 5).map((c) => c.key).join(", ")}${flagMissing.length > 5 ? " …" : ""})`);
  if (flagStale.length > 0) say(`${C.yellow}  Flaggans anteckning ändrad sedan översättningen:${C.reset} ${flagStale.map((c) => c.key).join(", ")}`);
  if (unknown.length > 0) say(`${C.yellow}  Okända nycklar (hoppas över):${C.reset} ${unknown.join(", ")}`);

  if (args.flags.ja !== true) {
    const ok = await confirm(`Skriv översättningarna till ${targetName(target)}?`);
    if (!ok) return say("Avbrutet.");
  }

  const deck = deckIdFor(key);
  const cardJson = Object.fromEntries(
    Object.entries(file.cards)
      .filter(([k]) => known.has(k))
      .map(([k, entry]) => [k, toStored(entry)]),
  );
  const sql = `
    with c as (
      update public.cards k set translation_en = x.value
      from jsonb_each(${sqlLiteral(JSON.stringify(cardJson))}::jsonb) as x(key, value)
      where k.deck_id = '${deck}'::uuid and k.key = x.key and k.translation_en is distinct from x.value
      returning 1
    ), a as (
      update public.categories g set title_en = x.value
      from jsonb_each_text(${sqlLiteral(JSON.stringify(file.areas))}::jsonb) as x(key, value)
      where g.deck_id = '${deck}'::uuid and g.key = x.key and g.title_en is distinct from x.value
      returning 1
    ), d as (
      update public.decks set description_en = ${file.deck?.description ? sqlLiteral(file.deck.description) : "null"}
      where id = '${deck}'::uuid and description_en is distinct from ${file.deck?.description ? sqlLiteral(file.deck.description) : "null"}
      returning 1
    )
    select (select count(*) from c) as cards, (select count(*) from a) as areas, (select count(*) from d) as deck;`;
  const rows = query<{ cards: number; areas: number; deck: number }>(target, sql);
  say(`${C.green}Klart.${C.reset} kort: ${rows[0]?.cards ?? 0}, områden: ${rows[0]?.areas ?? 0}, kursbeskrivning: ${rows[0]?.deck ?? 0}`);
  say(dim("Översättningen syns i granskningen med reglaget English."));
}
