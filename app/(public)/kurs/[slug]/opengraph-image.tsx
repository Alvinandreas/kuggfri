import { ImageResponse } from "next/og";
import { dictionary } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { getDeckBySlug } from "@/lib/content/queries";
import { ogCard, OG_SIZE } from "@/lib/ui/og";

export const size = OG_SIZE;
export const contentType = "image/png";
// Alt-texten måste vara statisk: delningsbilden för länkar har alltid den svenska.
export const alt = dictionary("sv").app.name;

/**
 * Delningsbild per kurs: den bild studenterna faktiskt skickar vidare. Den hör till
 * inbjudningssidan, eftersom det är den en chattklient (utan inloggning) får när den
 * hämtar en kurslänk /d/<slug> — middleware skriver om dit (lib/auth/route-gate.ts).
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sv = await getT();
  const data = await getDeckBySlug(slug);
  if (!data) return new ImageResponse(ogCard({ title: sv.app.tagline, subtitle: sv.home.lead }, sv), size);
  // Kursens egen beskrivning säger mer än en upprepad slogan; kortantalet får foten.
  const description = data.deck.description ?? sv.app.tagline;
  return new ImageResponse(
    ogCard({
      title: data.deck.title,
      subtitle: description.length > 150 ? `${description.slice(0, 147).trimEnd()}…` : description,
      badge: data.deck.course_code,
      footer: sv.deck.totalCards(data.cards.length),
    }, sv),
    size,
  );
}
