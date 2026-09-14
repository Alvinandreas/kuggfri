/**
 * Kategorifärger. Index bestäms av kategorins plats i decket (0-baserat) och
 * cyklar över tio tokens definierade i app/globals.css.
 */
export const TAG_COUNT = 10;

const bgClasses = [
  "bg-tag-1",
  "bg-tag-2",
  "bg-tag-3",
  "bg-tag-4",
  "bg-tag-5",
  "bg-tag-6",
  "bg-tag-7",
  "bg-tag-8",
  "bg-tag-9",
  "bg-tag-10",
] as const;

export function tagBgClass(index: number): string {
  return bgClasses[((index % TAG_COUNT) + TAG_COUNT) % TAG_COUNT] ?? "bg-tag-10";
}

/** Bygger en karta kategori-id -> färgindex utifrån kategoriernas ordning. */
export function categoryColorIndex(categories: readonly { id: string }[]): Map<string, number> {
  return new Map(categories.map((c, i) => [c.id, i] as const));
}
