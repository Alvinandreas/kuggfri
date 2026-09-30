import type { Metadata } from "next";
import { parseOptions } from "@/lib/cards/kinds";
import { notFound } from "next/navigation";
import { getDeckBySlug } from "@/lib/content/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { isStudyMode, type StudyMode } from "@/lib/progress/types";
import { parseSelection } from "@/lib/study/selection";
import { parseSessionSettings } from "@/lib/study/session-settings";
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

  const rawMode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
  const mode: StudyMode = isStudyMode(rawMode) ? rawMode : "fsrs";
  const selection = parseSelection(query.urval);
  const rawExtra = Array.isArray(query.nya) ? query.nya[0] : query.nya;
  const parsedExtra = rawExtra ? Number.parseInt(rawExtra, 10) : Number.NaN;
  const extraNew = Number.isFinite(parsedExtra) && parsedExtra > 0 ? Math.min(200, parsedExtra) : null;
  const onlyStarred = (Array.isArray(query.stjarnor) ? query.stjarnor[0] : query.stjarnor) === "1";
  // Passets inställningar (antal, ledtrådar, ordning, uppgiftstyper …), valda under Ditt pass.
  const settingsMode = onlyStarred && mode === "free" ? "starred" : mode;
  const settings = parseSessionSettings(settingsMode, query);
  const onlyOriginal = (Array.isArray(query.original) ? query.original[0] : query.original) === "1";
  // Plugga vidare (vidare=1): ett extra pass i schemalagt läge när dagens kort är klara.
  const extra = mode === "fsrs" && (Array.isArray(query.vidare) ? query.vidare[0] : query.vidare) === "1";
  // Löpnummer i en kedja av fortsättningar från sammanfattningen: ger varje nytt pass en egen adress.
  const rawPass = Number.parseInt((Array.isArray(query.pass) ? query.pass[0] : query.pass) ?? "", 10);
  const pass = Number.isFinite(rawPass) && rawPass > 0 ? Math.min(10_000, rawPass) : 0;

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
      categories={data.categories.map((c) => ({ id: c.id, title: c.title }))}
      cards={data.cards.map((c) => ({
        id: c.id,
        category_id: c.category_id,
        front: c.front,
        back: c.back,
        hint: c.hint,
        sort_order: c.sort_order,
        kind: c.kind ?? "sjalvskattning",
        options: parseOptions(c.options),
        original: c.original ?? false,
      }))}
      mode={mode}
      selection={selection}
      userId={user?.id ?? null}
    />
  );
}
