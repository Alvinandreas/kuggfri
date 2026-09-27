"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, CircleCheckBig, Flame } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { estimateKnowledge } from "@/lib/fsrs/scheduler";
import type { ProgressMap, ReviewEntry } from "@/lib/progress/types";
import { DEFAULT_PREFS, readPrefs, type StudyPrefs } from "@/lib/progress/prefs";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { buildProgressStats } from "@/lib/stats/progress-stats";
import { planDeckSession, type DeckPlan } from "@/lib/study/deck-plan";
import { parseExamDate } from "@/lib/study/plan";
import type { SelectableCard } from "@/lib/study/selection";
import { BarChart } from "@/components/stats/BarChart";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardLink, SectionTitle } from "@/components/ui/Card";
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
  knowledge: number;
  reviewed: number;
  perCategory: { id: string; title: string; share: number }[];
  lastActivity: number;
  exam: Date | null;
};

const TONES = ["accent", "chart-2", "chart-3"] as const;

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

export function HomeDashboard({ userId, firstName, decks }: Props) {
  const store = useProgressStore(userId);
  const [progress, setProgress] = useState<ProgressMap | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [prefs, setPrefs] = useState<StudyPrefs>(DEFAULT_PREFS);
  const [hour, setHour] = useState<number | null>(null);

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
    return decks.map((deck) => {
      const ids = deck.cards.map((c) => c.id);
      const idSet = new Set(ids);
      const k = estimateKnowledge(ids, progress ?? {}, now);
      const perCategory = deck.categories.map((c) => {
        const catIds = deck.cards.filter((card) => card.category_id === c.id).map((card) => card.id);
        return { id: c.id, title: c.title, share: estimateKnowledge(catIds, progress ?? {}, now).share };
      });
      const lastActivity = reviews.reduce((max, r) => (idSet.has(r.card_id) ? Math.max(max, Date.parse(r.reviewed_at)) : max), 0);
      return {
        deck,
        plan: planDeckSession({ deck, cards: deck.cards, progress, reviews, mode: "fsrs", selectedIds: [], dailyNew: prefs.dailyNew, now }),
        knowledge: k.share,
        reviewed: k.reviewed,
        perCategory,
        lastActivity,
        exam: examStart(deck.exam_date),
      };
    });
  }, [decks, progress, reviews, prefs.dailyNew]);

  // Huvudkursen: den man senast pluggat i, annars den första.
  const primary = useMemo(() => [...views].sort((a, b) => b.lastActivity - a.lastActivity)[0] ?? null, [views]);
  const others = views.filter((v) => v !== primary);
  const loading = progress === null;
  const leftToday = views.reduce((n, v) => n + v.plan.sessionCards, 0);
  const anyStarted = views.some((v) => v.reviewed > 0);

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
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-4 font-bold"
              title={sv.dashboard.streakLabel}
              data-testid="home-streak"
            >
              <Flame size={18} aria-hidden className={overall.streak > 0 ? "text-chart-3" : "text-subtle"} />
              {sv.dashboard.streak(overall.streak)}
            </span>
          </div>
        ) : null}
      </header>

      {primary === null ? (
        <Card padding="lg" className="text-muted">
          {sv.home.empty}
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <CourseBlock view={primary} loading={loading} />
          {/* Under xl flyter sidokolumnen in i huvudflödet, med dagens pass först: knappen ska synas utan att scrolla. */}
          <div className="contents xl:grid xl:content-start xl:gap-6">
            <TodayCard view={primary} loading={loading} className="order-first xl:order-none" />
            <StatsCard loading={loading} stats={overall} />
            {overall && overall.hasReviews ? (
              <Card padding="md" className="anim-fade-up" style={{ ["--i" as string]: 4 }}>
                <p className="mb-2 text-sm font-semibold text-subtle">{sv.dashboard.activity}</p>
                <div className="mx-auto max-w-md">
                  <BarChart
                    title={sv.dashboard.activity}
                    hideTitle
                    points={overall.series.map((p) => ({ key: p.day, label: p.label, value: p.reviews }))}
                    formatValue={(v) => sv.stats.cards(v)}
                  />
                </div>
              </Card>
            ) : null}
          </div>
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
              <li key={v.deck.id} className="anim-fade-up" style={{ ["--i" as string]: i + 4 }}>
                <CardLink href={`/d/${v.deck.slug}`} padding="lg" className="h-full">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold tracking-tight">{v.deck.title}</h3>
                    {v.plan.sessionCards > 0 && v.reviewed > 0 ? (
                      <Badge tone="accent">{sv.dashboard.cardsLeft(v.plan.sessionCards)}</Badge>
                    ) : v.reviewed === 0 ? (
                      <Badge>{sv.dashboard.notStarted}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {[v.deck.course_code, sv.home.cards(v.deck.cards.length)].filter(Boolean).join(" · ")}
                  </p>
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

function CourseBlock({ view, loading }: { view: DeckView; loading: boolean }) {
  const { deck, exam, knowledge, perCategory } = view;
  const examFuture = exam !== null && exam.getTime() > Date.now();
  return (
    <Card padding="lg" className="anim-fade-up" style={{ ["--i" as string]: 1 }} data-testid="home-course">
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
        <div className="flex items-center gap-2">
          {exam && examFuture ? (
            <Countdown to={exam} label={sv.dashboard.examCountdown} />
          ) : exam ? (
            <Badge tone="outline">{sv.dashboard.examPast}</Badge>
          ) : null}
          <Link
            href={`/d/${deck.slug}`}
            aria-label={`${sv.dashboard.courseSettings}: ${deck.title}`}
            title={sv.dashboard.courseSettings}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong transition-colors hover:bg-surface-2"
          >
            <ArrowUpRight size={18} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="mt-7 grid gap-7 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <div className="sm:border-r sm:border-line sm:pr-8" title={sv.dashboard.knowledgeHelp}>
          {loading ? (
            <Skeleton className="h-14 w-28" />
          ) : (
            <p className="text-5xl font-extrabold tracking-tight" data-testid="home-knowledge">
              {Math.round(knowledge * 100)}
              <span className="text-2xl text-muted"> %</span>
            </p>
          )}
          <p className="mt-1 font-semibold">{sv.dashboard.knowledge}</p>
        </div>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {perCategory.map((c, i) => (
            <div key={c.id} className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{c.title}</span>
                <span className="shrink-0 tabular-nums text-muted">{loading ? "–" : `${Math.round(c.share * 100)} %`}</span>
              </div>
              <ProgressBar value={loading ? 0 : c.share} label={c.title} tone={TONES[i % TONES.length]} />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function TodayCard({ view, loading, className = "" }: { view: DeckView; loading: boolean; className?: string }) {
  const { plan, reviewed } = view;
  const done = !loading && plan.nothingDue;
  return (
    <Card padding="lg" className={`anim-fade-up ${className}`} style={{ ["--i" as string]: 2 }} data-testid="home-today">
      <p className="text-sm font-semibold text-subtle">{sv.dashboard.today}</p>
      {loading ? (
        <div className="mt-3 grid gap-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      ) : done ? (
        <>
          <p className="mt-2 flex items-center gap-2 text-xl font-bold tracking-tight">
            <CircleCheckBig size={22} className="text-accent" aria-hidden />
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
          <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums">{sv.stats.cards(plan.sessionCards)}</p>
          <p className="mt-1 text-sm text-muted">{sv.dashboard.todayPlan(plan.sessionDue, plan.sessionNew)}</p>
          <LinkButton href={plan.startHref} size="lg" className="mt-5 w-full" data-testid="home-start">
            {reviewed > 0 ? sv.dashboard.continue : sv.dashboard.startFirst}
            <ArrowRight size={18} aria-hidden />
          </LinkButton>
        </>
      )}
    </Card>
  );
}

function StatsCard({ loading, stats }: { loading: boolean; stats: ReturnType<typeof buildProgressStats> | null }) {
  const items: Array<[string, string]> = stats
    ? [
        [sv.dashboard.reviewsToday, `${stats.reviewsToday}`],
        [sv.dashboard.learned, `${stats.learned}`],
        [sv.dashboard.avg7, stats.avg7 === null ? "–" : stats.avg7.toFixed(1)],
      ]
    : [];
  return (
    <Card padding="lg" className="anim-fade-up" style={{ ["--i" as string]: 3 }}>
      <dl className="grid grid-cols-3 gap-3">
        {loading
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)
          : items.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold text-subtle">{label}</dt>
                <dd className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">{value}</dd>
              </div>
            ))}
      </dl>
    </Card>
  );
}
