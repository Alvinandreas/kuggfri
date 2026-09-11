import { StudySession } from "@/components/study/StudySession";
import { isStudyMode } from "@/lib/progress/types";
import { parseSelection } from "@/lib/study/selection";
import { loadPreviewDeck } from "../_data";

export default async function PreviewStudyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const { deck, categories, cards } = loadPreviewDeck();
  const rawMode = Array.isArray(q.mode) ? q.mode[0] : q.mode;
  const mode = isStudyMode(rawMode) ? rawMode : "fsrs";
  return (
    <StudySession
      key={`${mode}-${JSON.stringify(q.urval)}`}
      deck={deck}
      categories={categories}
      cards={cards}
      mode={mode}
      selection={parseSelection(q.urval)}
      userId={null}
    />
  );
}
