// Förhandsvisning UTAN databas, bara för utveckling. Läser korten direkt från seed/.
// Den statiska rutten /d/dev-preview vinner över /d/[slug]. Svarar 404 i produktion.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { parseImportCsv } from "@/lib/import/parse-import";
import { normalizeBrainscapeMarkdown } from "@/lib/import/normalize";

export function loadPreviewDeck() {
  if (process.env.NODE_ENV === "production") notFound();
  const dir = join(process.cwd(), "seed", "materialteknik");
  const manifest = JSON.parse(readFileSync(join(dir, "deck.json"), "utf8")) as {
    title: string;
    description: string;
    course_code: string;
    source_credit: string;
    categories: { file: string; title: string }[];
  };
  const categories = manifest.categories.map((c, i) => ({ id: `kat-${i}`, title: c.title }));
  const cards = manifest.categories.flatMap((c, ci) =>
    parseImportCsv(readFileSync(join(dir, c.file), "utf8")).cards.map((card, i) => ({
      id: `kort-${ci}-${i}`,
      category_id: `kat-${ci}`,
      front: normalizeBrainscapeMarkdown(card.front),
      back: normalizeBrainscapeMarkdown(card.back),
      hint: null,
      sort_order: ci * 100 + i,
    })),
  );
  const deck = {
    id: "deck-preview",
    slug: "dev-preview",
    title: `${manifest.title} (förhandsvisning utan databas)`,
    description: manifest.description,
    course_code: manifest.course_code,
    source_credit: manifest.source_credit,
  };
  return { deck, categories, cards };
}
