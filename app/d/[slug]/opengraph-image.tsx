import { ImageResponse } from "next/og";
import { sv } from "@/lib/i18n/sv";
import { getDeckBySlug } from "@/lib/content/queries";
import { ogCard, OG_SIZE } from "@/lib/ui/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = sv.app.name;

/** Delningsbild per kurs: den bild studenterna faktiskt skickar vidare. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getDeckBySlug(slug);
  if (!data) return new ImageResponse(ogCard({ title: sv.app.tagline, subtitle: sv.home.lead }), size);
  // Kursens egen beskrivning säger mer än en upprepad slogan; kortantalet får foten.
  const description = data.deck.description ?? sv.app.tagline;
  return new ImageResponse(
    ogCard({
      title: data.deck.title,
      subtitle: description.length > 150 ? `${description.slice(0, 147).trimEnd()}…` : description,
      badge: data.deck.course_code,
      footer: sv.deck.totalCards(data.cards.length),
    }),
    size,
  );
}
