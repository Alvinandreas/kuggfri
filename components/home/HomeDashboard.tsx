"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CircleCheckBig, Flame, GraduationCap, Target } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { estimateKnowledge } from "@/lib/fsrs/scheduler";
import type { ProgressMap, ReviewEntry } from "@/lib/progress/types";
import { DEFAULT_PREFS, readPrefs, type StudyPrefs } from "@/lib/progress/prefs";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { buildProgressStats, type ProgressStats } from "@/lib/stats/progress-stats";
import { planDeckSession, type DeckPlan } from "@/lib/study/deck-plan";
import { estimateMinutes, parseExamDate } from "@/lib/study/plan";
import { categoryStats, type CategoryStats, type SelectableCard } from "@/lib/study/selection";
import { percent } from "@/lib/text/percent";
import { RadarBars, RadarChart, type RadarAxis } from "@/components/stats/RadarChart";
import { CategoryFocusDialog } from "@/components/stats/CategoryFocusDialog";
import { DuggaDialog } from "./DuggaDialog";
import { TrickyDialog } from "./TrickyDialog";
import { StatTile } from "@/components/stats/StatTile";
import { Badge } from "@/components/ui/Badge";
import { ActionList, ActionRow } from "@/components/ui/ActionRow";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardHeader, CardLink, SectionTitle } from "@/components/ui/Card";
import { Countdown } from "@/components/ui/Countdown";
import { ProgressBar } from "@/components/ui/ProgressBar";

export type HomeDeck = {
  id: string;
  slug: string;
  title: string;
  course_code: string | null;
  exam_date: string | null;
  categories: { id: string; title: string }[];
  cards: SelectableCard[];
};

type Props = { userId: string | null; firstName: string; decks: HomeDeck[] };

type DeckView = {
  deck: HomeDeck;
  plan: DeckPlan;
  /** Kunskap just nu enligt FSRS, 0–1. */
  knowledge: number;
  /** Nyckeltal för just den här kursen. */
  stats: ProgressStats;
  axes: RadarAxis[];
  categoryStats: CategoryStats[];
  /** Genväg på hemsidan: kluriga kort över hela kursen. */
  trickyPlan: DeckPlan;
  lastActivity: number;
  exam: Date | null;
};

/** Tentor på Chalmers börjar oftast 08.30; nedräkningen siktar dit. */
function examStart(date: string | null): Date | null {
  const d = parseExamDate(date);
  if (!d) return null;
  d.setHours(8, 30, 0, 0);
  return d;
}

function Skeleton({ className }: { className: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}

/**
 * Hemsidan: dagens pass, hur det går i kursen (inlärd kunskap, nyckeltal), kunskap per
 * område i radardiagrammet och aktiviteten de senaste två veckorna. Progressen laddas i
 * klienten med samma moduler som decksidan, så siffrorna är alltid desamma på båda ställena.
 */
export function HomeDashboard({ userId, firstName, decks }: Props) {
  const store = useProgressStore(userId);
  const [progress, setProgress] = useState<ProgressMap | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [prefs, setPrefs] = useState<StudyPrefs>(DEFAULT_PREFS);
  const [hour, setHour] = useState<number | null>(null);
  const [axisHover, setAxisHover] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  // Genvägarna i dagens block öppnar var sin dialog i stället för att lämna sidan.
  const [quick, setQuick] = useState<"tricky" | "dugga" | null>(null);

  const allIds = useMemo(() => decks.flatMap((d) => d.cards.map((c) => c.id)), [decks]);

  useEffect(() => {
    setPrefs(readPrefs(window.localStorage));
    setHour(new Date().getHours());
  }, []);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    Promise.all([store.load(allIds), store.loadReviews(allIds)])
      .then(([p, r]) => {
        if (cancelled) return;
        setProgress(p);
        setReviews(r);
      })
      .catch(() => {
        if (cancelled) return;
        setProgress({});
        setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [store, allIds]);

  const overall = useMemo(
    () => (progress ? buildProgressStats({ cardIds: allIds, progress, reviews, weekdaysOnly: prefs.weekdaysOnly }) : null),
    [allIds, progress, reviews, prefs.weekdaysOnly],
  );

  const views: DeckView[] = useMemo(() => {
    const now = new Date();
    const p = progress ?? {};
    return decks.map((deck) => {
      const ids = deck.cards.map((c) => c.id);
      const idSet = new Set(ids);
      const perCategory = categoryStats(
        deck.cards,
        p,
        deck.categories.map((c) => c.id),
      );
      const byId = new Map(perCategory.map((s) => [s.categoryId, s] as const));
      const axes = deck.categories.map((c, i) => {
        const s = byId.get(c.id);
        return { key: c.id, label: c.title, colorIndex: i, total: s?.total ?? 0, partial: s?.partial ?? 0, learned: s?.learned ?? 0 };
      });
      return {
        deck,
        plan: planDeckSession({ deck, cards: deck.cards, progress, reviews, mode: "fsrs", selectedIds: [], dailyNew: prefs.dailyNew, now }),
        knowledge: estimateKnowledge(ids, p, now).share,
        stats: buildProgressStats({ cardIds: ids, progress: p, reviews, weekdaysOnly: prefs.weekdaysOnly, now }),
        axes,
        categoryStats: perCategory,
        trickyPlan: planDeckSession({ deck, cards: deck.cards, progress, reviews, mode: "tricky", selectedIds: [], dailyNew: prefs.dailyNew, now }),
        lastActivity: reviews.reduce((max, r) => (idSet.has(r.card_id) ? Math.max(max, Date.parse(r.reviewed_at)) : max), 0),
        exam: examStart(deck.exam_date),
      };
    });
  }, [decks, progress, reviews, prefs.dailyNew, prefs.weekdaysOnly]);

  // Huvudkursen: den man senast pluggat i, annars den första.
  const primary = useMemo(() => [...views].sort((a, b) => b.lastActivity - a.lastActivity)[0] ?? null, [views]);
  const others = views.filter((v) => v !== primary);
  const loading = progress === null;
  const leftToday = views.reduce((n, v) => n + v.plan.sessionCards, 0);
  const anyStarted = views.some((v) => v.stats.seen > 0);

  const lead = loading
    ? sv.dashboard.loading
    : !anyStarted
      ? primary && primary.plan.sessionCards > 0
        ? sv.dashboard.leadFirst(primary.plan.sessionCards)
        : sv.dashboard.leadStart
      : leftToday > 0
        ? sv.dashboard.leadDue(leftToday)
        : sv.dashboard.leadDone;

  return (
    <div>
      <header className="anim-fade-up mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {hour === null ? sv.dashboard.title : sv.dashboard.greeting(hour, firstName)}
          </h1>
          <p className="mt-2 text-lg text-muted" data-testid="home-lead">
            {lead}
          </p>
        </div>
        {overall ? (
          <span className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-4 font-bold" title={sv.dashboard.streakLabel} data-testid="home-streak">
            <Flame size={18} aria-hidden className={overall.streak > 0 ? "text-chart-3" : "text-subtle"} />
            {sv.dashboard.streak(overall.streak)}
          </span>
        ) : null}
      </header>

      {primary === null ? (
        <Card padding="lg" className="text-muted">
          {sv.home.empty}
        </Card>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <CourseCard view={primary} loading={loading} />
            {/* På smala skärmar kommer dagens pass först: knappen ska synas utan att scrolla. */}
            <TodayCard view={primary} loading={loading} onQuick={setQuick} className="order-first xl:order-none" />
          </div>
          <KnowledgeCard view={primary} loading={loading} hover={axisHover} onHover={setAxisHover} onSelect={setFocusIndex} />
          <CategoryFocusDialog
            open={focusIndex !== null}
            onClose={() => setFocusIndex(null)}
            deck={primary.deck}
            cards={primary.deck.cards}
            category={focusIndex === null ? null : (primary.axes[focusIndex] ? { id: primary.axes[focusIndex].key, title: primary.axes[focusIndex].label, colorIndex: focusIndex } : null)}
            stats={focusIndex === null ? undefined : primary.categoryStats.find((c) => c.categoryId === primary.axes[focusIndex]?.key)}
            progress={progress}
            reviews={reviews}
            dailyNew={prefs.dailyNew}
          />
          <TrickyDialog
            open={quick === "tricky"}
            onClose={() => setQuick(null)}
            deck={primary.deck}
            cards={primary.deck.cards}
            categories={primary.axes.map((a) => ({ id: a.key, title: a.label, colorIndex: a.colorIndex }))}
            categoryStats={primary.categoryStats}
            progress={progress}
            reviews={reviews}
            dailyNew={prefs.dailyNew}
          />
          <DuggaDialog
            open={quick === "dugga"}
            onClose={() => setQuick(null)}
            deck={primary.deck}
            cards={primary.deck.cards}
            progress={progress}
            reviews={reviews}
            dailyNew={prefs.dailyNew}
          />
        </div>
      )}

      {others.length > 0 ? (
        <section className="mt-10">
          <SectionTitle
            action={
              <Link href="/kurser" className="text-sm font-semibold text-accent hover:underline">
                {sv.dashboard.allCourses}
              </Link>
            }
          >
            {sv.dashboard.moreCourses}
          </SectionTitle>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((v, i) => (
              <li key={v.deck.id} className="anim-fade-up" style={{ ["--i" as string]: i + 5 }}>
                <CardLink href={`/d/${v.deck.slug}`} padding="lg" className="h-full">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold tracking-tight">{v.deck.title}</h3>
                    {v.stats.seen === 0 ? (
                      <Badge>{sv.dashboard.notStarted}</Badge>
                    ) : v.plan.sessionCards > 0 ? (
                      <Badge tone="accent">{sv.dashboard.cardsLeft(v.plan.sessionCards)}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">{[v.deck.course_code, sv.home.cards(v.deck.cards.length)].filter(Boolean).join(" · ")}</p>
                  <div className="mt-5 flex items-center gap-3">
                    <ProgressBar value={v.knowledge} label={`${sv.dashboard.knowledge}: ${v.deck.title}`} />
                    <span className="text-sm font-semibold tabular-nums">{Math.round(v.knowledge * 100)} %</span>
                  </div>
                </CardLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Kursen i överblick: inlärd kunskap och fyra nyckeltal på en rad. */
function CourseCard({ view, loading }: { view: DeckView; loading: boolean }) {
  const { deck, exam, knowledge, stats } = view;
  const examFuture = exam !== null && exam.getTime() > Date.now();
  return (
    <Card padding="lg" className="anim-fade-up flex flex-col" style={{ ["--i" as string]: 1 }} data-testid="home-course">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
            <BookOpen size={22} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold tracking-tight">{deck.title}</h2>
            <p className="text-sm text-muted">{[deck.course_code, sv.home.cards(deck.cards.length)].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        {exam && examFuture ? (
          <Countdown to={exam} label={sv.dashboard.examCountdown} />
        ) : exam ? (
          <Badge tone="outline">{sv.dashboard.examPast}</Badge>
        ) : null}
      </div>

      {/* Inlärd kunskap: stort tal till vänster, stapel och underlag till höger. */}
      <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-4" title={sv.dashboard.knowledgeHelp}>
        <div>
          {loading ? (
            <Skeleton className="h-16 w-32" />
          ) : (
            <p className="text-6xl font-extrabold leading-none tracking-tight" data-testid="home-knowledge">
              {Math.round(knowledge * 100)}
              <span className="text-3xl text-muted"> %</span>
            </p>
          )}
          <p className="mt-2 font-bold">{sv.dashboard.knowledge}</p>
        </div>
        <div className="min-w-48 flex-1 pb-1">
          <ProgressBar value={loading ? 0 : knowledge} label={sv.dashboard.knowledge} size="md" />
          <p className="mt-2 text-sm text-muted" data-testid="home-seen">
            {loading ? " " : sv.deck.seen(stats.seen, stats.totalCards)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-auto grid grid-cols-2 gap-3 pt-6 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <dl className="mt-auto grid grid-cols-2 gap-3 pt-6 sm:grid-cols-4">
          <StatTile label={sv.stats.learned} help={sv.stats.learnedHelp} value={`${stats.learned}`} sub={`${percent(stats.learned, stats.totalCards)} % av ${stats.totalCards}`} tone="green" />
          <StatTile
            label={sv.stats.streak}
            help={sv.stats.streakHelp}
            value={`${stats.streak}`}
            sub={stats.freezeUsedRecently ? sv.summary.freezeUsed : sv.summary.freezesLeft(stats.freezesLeft)}
            tone="navy"
          />
          <StatTile
            label={sv.stats.today}
            value={`${stats.reviewsToday}`}
            sub={view.plan.sessionCards > 0 ? sv.dashboard.cardsLeft(view.plan.sessionCards) : sv.deck.metaDone}
            tone="teal"
          />
          <StatTile
            label={sv.dashboard.avg7}
            value={stats.avg7 === null ? "–" : stats.avg7.toFixed(1).replace(".", ",")}
            sub={stats.avg7 === null ? sv.dashboard.avg7None : sv.dashboard.avg7Sub}
            tone="violet"
          />
        </dl>
      )}
    </Card>
  );
}

/**
 * Radardiagrammet och kategoristaplarna bredvid varandra; hover följs åt mellan dem, och
 * ett klick på ett område (i diagrammet eller listan) öppnar det i en dialog.
 */
function KnowledgeCard({
  view,
  loading,
  hover,
  onHover,
  onSelect,
}: {
  view: DeckView;
  loading: boolean;
  hover: number | null;
  onHover: (i: number | null) => void;
  onSelect: (i: number) => void;
}) {
  if (view.axes.length < 3) return null;
  return (
    <Card padding="lg" className="anim-fade-up" style={{ ["--i" as string]: 3 }} data-testid="home-radar">
      <CardHeader title={sv.stats.radar} description={sv.focus.hint} />
      {loading ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <RadarChart title={sv.stats.radar} hideTitle size="lg" axes={view.axes} hover={hover} onHover={onHover} onSelect={onSelect} />
          <RadarBars axes={view.axes} hover={hover} onHover={onHover} columns={2} onSelect={onSelect} />
        </div>
      )}
    </Card>
  );
}

/** Dagens pass med en stor knapp, och genvägar (dialoger) till kluriga kort och dugga. */
function TodayCard({
  view,
  loading,
  onQuick,
  className = "",
}: {
  view: DeckView;
  loading: boolean;
  onQuick: (which: "tricky" | "dugga") => void;
  className?: string;
}) {
  const { plan, stats, trickyPlan } = view;
  const done = !loading && plan.nothingDue;
  return (
    <Card padding="lg" className={`anim-fade-up flex flex-col ${className}`} style={{ ["--i" as string]: 2 }} data-testid="home-today">
      <p className="text-sm font-semibold text-muted">{sv.dashboard.today}</p>
      {loading ? (
        <div className="mt-3 grid gap-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      ) : done ? (
        <>
          <p className="mt-2 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <CircleCheckBig size={24} className="text-accent" aria-hidden />
            {sv.dashboard.doneTitle}
          </p>
          <p className="mt-1 text-sm text-muted">{sv.dashboard.doneBody}</p>
          {plan.moreNew > 0 ? (
            <LinkButton href={plan.moreHref} variant="outline" className="mt-5 w-full">
              {sv.dashboard.moreNew(plan.moreNew)}
            </LinkButton>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-2 text-4xl font-extrabold tracking-tight tabular-nums">{sv.stats.cards(plan.sessionCards)}</p>
          <p className="mt-1 text-sm text-muted" data-testid="home-today-plan">
            {sv.dashboard.todayPlan(plan.sessionDue, plan.sessionNew)} · cirka {estimateMinutes(plan.sessionCards)} min
          </p>
          {/* Till kurssidan, där läge och områden väljs; dagens pass är förvalt där. */}
          <LinkButton href={`/d/${view.deck.slug}`} size="lg" className="mt-5 w-full" data-testid="home-start">
            {stats.seen > 0 ? sv.dashboard.continue : sv.dashboard.startFirst}
            <ArrowRight size={18} aria-hidden />
          </LinkButton>
        </>
      )}
      {!loading ? (
        <ActionList className="mt-6 border-t border-line pt-5">
          {trickyPlan.selectionCount > 0 && stats.seen > 0 ? (
            <ActionRow
              onClick={() => onQuick("tricky")}
              icon={Target}
              title={sv.deck.modeTricky}
              meta={`${sv.stats.cards(trickyPlan.selectionCount)} · cirka ${estimateMinutes(trickyPlan.selectionCount)} min`}
              data-testid="home-tricky"
            />
          ) : null}
          <ActionRow onClick={() => onQuick("dugga")} icon={GraduationCap} title={sv.deck.modeExam} meta={sv.dugga.homeMeta} data-testid="home-dugga" />
        </ActionList>
      ) : null}
    </Card>
  );
}
