import { getExamRecord } from "@/lib/tentor/queries";
import { loadExamDeck } from "@/lib/tentor/server";
import { decodeDataUri } from "@/lib/tentor/images";

type Params = Promise<{ slug: string; key: string; fraga: string; nr: string }>;

const notFound = () => new Response("Hittades inte", { status: 404, headers: { "cache-control": "no-store" } });

/**
 * En figur i en tenta (lib/tentor/images.ts). Samma åtkomst som tentan: redaktörer alltid,
 * kursens deltagare när kursen är publicerad, tentaläget öppet och tentan publicerad. Figurerna är
 * frågornas bilder, inget facit, så de får visas under skrivtiden.
 */
export async function GET(_request: Request, { params }: { params: Params }) {
  const { slug, key, fraga, nr } = await params;
  const index = Number(nr);
  if (!Number.isInteger(index) || index < 0) return notFound();
  const ctx = await loadExamDeck(slug);
  if (!ctx) return notFound();
  const record = await getExamRecord(ctx.deck.id, key, ctx.access);
  const src = record?.exam.questions.find((q) => q.id === fraga)?.images[index];
  const image = src ? decodeDataUri(src) : null;
  if (!image) return notFound();
  return new Response(image.bytes.buffer as ArrayBuffer, {
    headers: {
      "content-type": image.type,
      // Adressen byter ?v= när figuren ändras; privat eftersom åtkomsten beror på besökaren.
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
