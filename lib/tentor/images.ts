/**
 * Tentornas figurer ligger som data-URI:er i tentabanken. De skickas aldrig inbäddade till
 * webbläsaren: en figur på några hundra kB i sidans RSC-data fick klientnavigeringen i
 * produktionsbygget att fastna (Visa facit gjorde ingenting). Sidorna byter i stället ut dem mot
 * en adress under tentan (app/(focus)/d/[slug]/tenta/[key]/bild/[fraga]/[nr]/route.ts), som
 * kontrollerar åtkomsten och svarar med bilden. Ren modul.
 */

/** Kort, stabil kontrollsumma (FNV-1a, 32 bitar) för att byta adress när figuren ändras. */
export function contentHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Adressen till figur nr `index` i uppgiften `questionId`. */
export function examImageUrl(slug: string, key: string, questionId: string, index: number, src: string): string {
  return `/d/${encodeURIComponent(slug)}/tenta/${encodeURIComponent(key)}/bild/${encodeURIComponent(questionId)}/${index}?v=${contentHash(src)}`;
}

/** Uppgifterna med figurernas data-URI:er utbytta mot adresser (andra källor lämnas orörda). */
export function withImageUrls<Q extends { id: string; images: string[] }>(questions: readonly Q[], slug: string, key: string): Q[] {
  return questions.map((q) => (q.images.some((src) => src.startsWith("data:")) ? { ...q, images: q.images.map((src, i) => (src.startsWith("data:") ? examImageUrl(slug, key, q.id, i, src) : src)) } : q));
}

/** En data-URI som bytes och innehållstyp; null om den inte är en base64-kodad bild. */
export function decodeDataUri(src: string): { type: string; bytes: Uint8Array } | null {
  const m = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml|avif));base64,([A-Za-z0-9+/=\s]+)$/.exec(src);
  if (!m) return null;
  const bin = atob((m[2] ?? "").replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { type: m[1] ?? "application/octet-stream", bytes };
}
