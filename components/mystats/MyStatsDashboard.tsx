"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChartColumn } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { DEFAULT_PREFS, readPrefs, type StudyPrefs } from "@/lib/progress/prefs";
import { useCardProgress } from "@/lib/progress/use-card-progress";
import { useProgressStore } from "@/lib/progress/use-progress-store";
import { buildProgressStats } from "@/lib/stats/progress-stats";
import { buildMilestones, buildMyStats, rankAreas, weeklyTotals, type RankedArea } from "@/lib/stats/my-stats";
import { categoryStats } from "@/lib/study/selection";
import { DAY_MS, parseDayKey, startOfDay } from "@/lib/time/day";
import { percent } from "@/lib/text/percent";
import type { HomeDeck } from "@/components/home/HomeDashboard";
import { ActivityHeatmap } from "@/components/stats/ActivityHeatmap";
import { BarChart, type BarPoint } from "@/components/stats/BarChart";
import { LineChart } from "@/components/stats/LineChart";
import { StatTile } from "@/components/stats/StatTile";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardHeader, SectionTitle } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { AreaCard, type AreaItem } from "./AreaCard";
import { MilestonesCard } from "./MilestonesCard";
import { RatingsCard } from "./RatingsCard";
import { RhythmCard } from "./RhythmCard";
import { routes } from "@/lib/routes";

type Props = { userId: string | null; decks: HomeDeck[] };

type Period = "30" | "90" | "all";

const HEATMAP_WEEKS = 20;

/**
 * Min statistik: nyckeltal, aktivitetskarta med rekord, utvecklingen över tid, pluggrytmen,
 * skattningarna, starkaste och svagaste områdena och milstolpar. Progress och historik
 * laddas i klienten med samma moduler som hemsidan, så siffrorna stämmer överens.
 */
export function MyStatsDashboard({ userId, decks }: Props) {
  const sv = useT();
  const store = useProgressStore(userId);
  const [prefs, setPrefs] = useState<StudyPrefs>(DEFAULT_PREFS);
  const [scope, setScope] = useState<string>("all");
  const [period, setPeriod] = useState<Period>("30");

  const allIds = useMemo(() => decks.flatMap((d) => d.cards.map((c) => c.id)), [decks]);

  useEffect(() => {
    setPrefs(readPrefs(window.localStorage));
  }, []);

  const { progress, reviews } = useCardProgress(store, allIds);

  const scoped = useMemo(() => (scope === "all" ? decks : decks.filter((d) => d.id === scope)), [decks, scope]);
  const ids = useMemo(() => scoped.flatMap((d) => d.cards.map((c) => c.id)), [scoped]);
  // "Nu" sätts när datan kommit, så att alla block räknar mot samma ögonblick.
  const now = useMemo(() => (progress ? new Date() : null), [progress]);

  const mine = useMemo(
    () => (now ? buildMyStats({ cardIds: ids, reviews, now, weekdaysOnly: prefs.weekdaysOnly }) : null),
    [ids, reviews, now, prefs.weekdaysOnly],
  );

  // Perioden "Allt" räknas från första repetitionen, minst två veckor och högst ett år
  // (fler veckostaplar än så får inte plats i stapeldiagrammet).
  const days = useMemo(() => {
    if (period !== "all") return Number(period);
    if (!mine?.firstDay || !now) return 30;
    const span = Math.round((startOfDay(now).getTime() - parseDayKey(mine.firstDay).getTime()) / DAY_MS) + 1;
    return Math.min(365, Math.max(14, span));
  }, [period, mine, now]);

  const overview = useMemo(
    () => (progress && now ? buildProgressStats({ cardIds: ids, progress, reviews, days, now, weekdaysOnly: prefs.weekdaysOnly }) : null),
    [ids, progress, reviews, days, now, prefs.weekdaysOnly],
  );

  const areas = useMemo(() => {
    const p = progress ?? {};
    const list: RankedArea<AreaItem>[] = scoped.flatMap((deck) => {
      const stats = categoryStats(deck.cards, p, deck.categories.map((c) => c.id), now ?? undefined);
      return deck.categories.flatMap((c, i) => {
        const s = stats[i];
        if (!s || s.total === 0) return [];
        return [
          {
            key: `${deck.id}:${c.id}`,
            title: c.title,
            colorIndex: i,
            href: routes.deck(deck.slug),
            deckTitle: scoped.length > 1 ? deck.title : null,
            learned: s.learned,
            total: s.total,
            share: s.learned / s.total,
            studied: s.studied,
            known: s.known / s.total,
          },
        ];
      });
    });
    return rankAreas(list);
  }, [scoped, progress, now]);

  const loading = !mine || !overview;
  const empty = !loading && mine.totalReviews === 0;
  const firstDeck = scoped[0] ?? decks[0] ?? null;

  const milestones = useMemo(
    () =>
      mine && overview
        ? buildMilestones({
            totalReviews: mine.totalReviews,
            longestStreak: mine.longestStreak,
            activeDays: mine.activeDays,
            seen: overview.seen,
            learned: overview.learned,
            totalCards: overview.totalCards,
            comebacks: mine.comebacks,
          })
        : [],
    [mine, overview],
  );

  const bars: { points: BarPoint[]; title: string } = useMemo(() => {
    const series = overview?.series ?? [];
    if (days <= 31) {
      return { title: sv.myStats.perDay, points: series.map((p) => ({ key: p.day, label: p.label, value: p.reviews })) };
    }
    return {
      title: sv.myStats.perWeek,
      points: weeklyTotals(series).map((w) => ({ key: w.key, label: w.label, value: w.reviews, detail: sv.myStats.weekOf(w.label) })),
    };
  }, [sv, overview, days]);

  const lead = loading
    ? sv.myStats.loading
    : empty || !mine.firstDay
      ? sv.myStats.leadEmpty
      : sv.myStats.lead(mine.totalReviews, mine.activeDays, sv.myStats.dateShort(parseDayKey(mine.firstDay)));

  return (
    <div>
      <header className="anim-fade-up mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{sv.myStats.title}</h1>
          <p className="mt-2 text-lg text-muted" data-testid="mystats-lead">
            {lead}
          </p>
        </div>
        {decks.length > 1 ? (
          <Select
            label={sv.myStats.scope}
            value={scope}
            onChange={setScope}
            fit
            size="sm"
            options={[{ value: "all", label: sv.myStats.allCourses }, ...decks.map((d) => ({ value: d.id, label: d.title }))]}
          />
        ) : null}
      </header>

      {decks.length === 0 ? (
        <Card padding="lg" className="text-muted">
          {sv.home.empty}
        </Card>
      ) : loading ? (
        <div className="grid gap-6" aria-hidden>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      ) : empty ? (
        <div className="grid gap-6">
          <Card padding="lg" className="anim-fade-up flex flex-col items-start gap-5 sm:flex-row sm:items-center" style={{ ["--i" as string]: 1 }} data-testid="mystats-empty">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
              <ChartColumn size={28} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold tracking-tight">{sv.myStats.emptyTitle}</h2>
              <p className="mt-1 max-w-2xl text-muted">{sv.myStats.emptyBody}</p>
            </div>
            {firstDeck ? (
              <LinkButton href={routes.deck(firstDeck.slug)} size="lg">
                {sv.myStats.emptyCta}
                <ArrowRight size={18} aria-hidden />
              </LinkButton>
            ) : null}
          </Card>
          <MilestonesCard milestones={milestones} index={2} />
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Nyckeltalen: fyra block direkt på duken. */}
          <dl className="anim-fade-up grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" style={{ ["--i" as string]: 1 }} data-testid="mystats-tiles">
            <StatTile
              variant="card"
              label={sv.myStats.streak}
              help={sv.stats.streakHelp}
              value={`${mine.streak}`}
              sub={overview.freezeUsedRecently ? sv.summary.freezeUsed : sv.summary.freezesLeft(overview.freezesLeft)}
              tone="navy"
            />
            <StatTile
              variant="card"
              label={sv.myStats.reviews}
              value={mine.totalReviews.toLocaleString(sv.meta.locale)}
              sub={sv.myStats.reviewsSub(mine.sessions)}
              tone="teal"
            />
            <StatTile
              variant="card"
              label={sv.myStats.learned}
              help={sv.stats.learnedHelp}
              value={`${overview.learned}`}
              sub={sv.myStats.learnedSub(percent(overview.learned, overview.totalCards), overview.totalCards)}
              tone="green"
            />
            <StatTile
              variant="card"
              label={sv.myStats.knowledge}
              help={sv.dashboard.knowledgeHelp}
              value={sv.meta.pct(Math.round(overview.knowledge.share * 100))}
              sub={sv.myStats.knowledgeSub}
              tone="violet"
            />
          </dl>

          {/* Aktivitetskartan med rekorden bredvid. */}
          <Card padding="lg" className="anim-fade-up" style={{ ["--i" as string]: 5 }} data-testid="mystats-activity">
            <CardHeader title={sv.myStats.activity} description={sv.myStats.activityHelp(HEATMAP_WEEKS)} />
            <div className="grid items-center gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
              <div className="w-full max-w-[44rem]">
                <ActivityHeatmap counts={mine.perDay} weeks={HEATMAP_WEEKS} now={now ?? undefined} title={sv.myStats.activity} hideTitle />
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <StatTile
                  label={sv.myStats.activeDays}
                  value={`${mine.activeDays}`}
                  sub={mine.firstDay ? sv.myStats.activeDaysSub(sv.myStats.dateShort(parseDayKey(mine.firstDay))) : ""}
                  tone="green"
                />
                <StatTile label={sv.myStats.longestStreak} value={`${mine.longestStreak}`} sub={sv.myStats.longestStreakSub} tone="navy" />
                <StatTile
                  label={sv.myStats.bestDay}
                  value={`${mine.bestDay?.reviews ?? 0}`}
                  sub={mine.bestDay ? sv.myStats.date(parseDayKey(mine.bestDay.day)) : ""}
                  tone="teal"
                />
                <StatTile label={sv.myStats.studyTime} value={sv.myStats.studyTimeValue(mine.studyMinutes)} sub={sv.myStats.studyTimeSub(mine.studyMinutes)} tone="violet" />
              </dl>
            </div>
          </Card>

          {/* Utvecklingen över vald period. */}
          <section className="anim-fade-up mt-4" style={{ ["--i" as string]: 6 }}>
            <SectionTitle
              action={
                <SegmentedControl<Period>
                  label={sv.myStats.period}
                  size="sm"
                  value={period}
                  onChange={setPeriod}
                  segments={[
                    { value: "30", label: sv.myStats.period30 },
                    { value: "90", label: sv.myStats.period90 },
                    { value: "all", label: sv.myStats.periodAll },
                  ]}
                />
              }
              className="flex-wrap"
            >
              {sv.myStats.development}
            </SectionTitle>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card padding="lg" data-testid="mystats-growth">
                <CardHeader title={sv.myStats.growth} description={sv.myStats.growthHelp} spacing="sm" />
                <LineChart
                  title={sv.myStats.growth}
                  hideTitle
                  area
                  labels={overview.series.map((p) => p.label)}
                  series={[
                    { key: "seen", label: sv.myStats.seriesSeen, tone: "chart-2", values: overview.series.map((p) => p.seen) },
                    { key: "learned", label: sv.myStats.seriesLearned, tone: "chart-1", values: overview.series.map((p) => p.learned) },
                  ]}
                  formatValue={(v) => `${v}`}
                />
              </Card>
              <Card padding="lg" data-testid="mystats-bars">
                <CardHeader title={bars.title} description={period === "all" ? sv.myStats.periodAllHelp : sv.myStats.periodHelp(days)} />
                <BarChart title={bars.title} hideTitle points={bars.points} formatValue={sv.myStats.reviewsCount} />
              </Card>
            </div>
          </section>

          <RhythmCard stats={mine} index={7} />

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <RatingsCard stats={mine} className="md:col-span-2 xl:col-span-1" index={8} />
            <AreaCard kind="strongest" items={areas.strongest} index={9} />
            <AreaCard kind="weakest" items={areas.weakest} index={10} />
          </div>

          <MilestonesCard milestones={milestones} index={11} />
        </div>
      )}
    </div>
  );
}
