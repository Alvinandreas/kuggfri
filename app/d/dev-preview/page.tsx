import { DeckOverview } from "@/components/study/DeckOverview";
import { loadPreviewDeck } from "./_data";

export default function PreviewDeckPage() {
  const { deck, categories, cards } = loadPreviewDeck();
  return (
    <DeckOverview
      deck={deck}
      categories={categories}
      cards={cards.map((c) => ({ id: c.id, category_id: c.category_id, sort_order: c.sort_order }))}
      userId={null}
    />
  );
}
