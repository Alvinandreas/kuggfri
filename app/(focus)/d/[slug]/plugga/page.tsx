import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDeckBySlug } from "@/lib/content/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { isStudyMode, type StudyMode } from "@/lib/progress/types";
import { parseSelection } from "@/lib/study/selection";
import { parseSessionSettings } from "@/lib/study/session-settings";
import { first, flag, positiveInt } from "@/lib/http/search-params";
import { toCategoryOption, toStudyCard } from "@/lib/content/view-models";
import { StudySession } from "@/components/study/StudySession";
import { sv } from "@/lib/i18n/sv";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getDeckBySlug(slug);
  return { title: data ? sv.study.pageTitle(data.deck.title) : sv.deck.start };
}

export default async function StudyPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [data, user] = await Promise.all([getDeckBySlug(slug), getCurrentUser()]);
  if (!data) notFound();

  const rawMode = first(query.mode);
  const mode: StudyMode = isStudyMode(rawMode) ? rawMode : "fsrs";
  const selection = parseSelection(query.urval);
  const extraNew = positiveInt(query.nya, 200);
  const onlyStarred = flag(query.stjarnor);
  // Passets inställningar (antal, ledtrådar, ordning, uppgiftstyper …), valda under Ditt pass.
  const settingsMode = onlyStarred && mode === "free" ? "starred" : mode;
  const settings = parseSessionSettings(settingsMode, query);
  const onlyOriginal = flag(query.original);
  // Plugga vidare (vidare=1): ett extra pass i schemalagt läge när dagens kort är klara.
  const extra = mode === "fsrs" && flag(query.vidare);
  // Löpnummer i en kedja av fortsättningar från sammanfattningen: ger varje nytt pass en egen adress.
  const pass = positiveInt(query.pass, 10_000) ?? 0;

  return (
    <StudySession
      key={`${mode}-${JSON.stringify(selection)}-${extraNew ?? ""}-${JSON.stringify(settings)}-${onlyStarred}-${onlyOriginal}-${extra}-${pass}`}
      deck={{ id: data.deck.id, slug: data.deck.slug, title: data.deck.title, exam_date: data.deck.exam_date }}
      extraNew={extraNew}
      extra={extra}
      pass={pass}
      settingsMode={settingsMode}
      settings={settings}
      onlyStarred={onlyStarred}
      onlyOriginal={onlyOriginal}
      categories={data.categories.map(toCategoryOption)}
      cards={data.cards.map(toStudyCard)}
      mode={mode}
      selection={selection}
      userId={user?.id ?? null}
    />
  );
}
