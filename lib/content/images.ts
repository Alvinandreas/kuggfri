/**
 * Bilder i korten. Ren modul.
 *
 * Bilder skrivs som vanlig markdown: `![Järns unära fasdiagram](/kort/materialteknik/jarn-unart.svg)`.
 * Filerna ligger i `public/kort/<kurs>/` och versionshanteras tillsammans med korten, så att de
 * följer med när en utgåva återställs. Bara den egna domänen är tillåten (sidans CSP och
 * integritet: inga externa bildvärdar som ser vilka studenter som pluggar).
 *
 * Regler (kontrolleras av `kuggfri kontrollera`):
 * - sökvägen börjar med /kort/<kurs>/ och filen finns
 * - format svg, webp, png eller jpg
 * - alt-texten beskriver bilden (minst 8 tecken), för skärmläsare och när bilden inte laddas
 */

export type ImageRef = { alt: string; src: string };

const IMAGE_RE = /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

export const IMAGE_EXTENSIONS = [".svg", ".webp", ".png", ".jpg", ".jpeg"] as const;

export function imageRefs(markdown: string): ImageRef[] {
  const out: ImageRef[] = [];
  for (const m of markdown.matchAll(IMAGE_RE)) out.push({ alt: (m[1] ?? "").trim(), src: m[2] ?? "" });
  return out;
}

/** Problem med en bildreferens (utan filsystemet). Tom lista = giltig. */
export function imageProblems(ref: ImageRef, courseKey: string): string[] {
  const problems: string[] = [];
  const prefix = `/kort/${courseKey}/`;
  if (!ref.src.startsWith(prefix)) problems.push(`Bilden ”${ref.src}” ska ligga under ${prefix} (public/kort/${courseKey}/).`);
  if (ref.src.includes("..")) problems.push(`Bilden ”${ref.src}” får inte innehålla "..".`);
  const lower = ref.src.toLowerCase();
  if (!IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) problems.push(`Bilden ”${ref.src}” har ett format som inte stöds (${IMAGE_EXTENSIONS.join(", ")}).`);
  if (ref.alt.length < 8) problems.push(`Bilden ”${ref.src}” saknar en beskrivande alt-text (minst 8 tecken).`);
  return problems;
}

/** Sökvägen i repot för en bild-URL, t.ex. /kort/x/a.svg → public/kort/x/a.svg. */
export function imageFilePath(src: string): string {
  return `public${src}`;
}
