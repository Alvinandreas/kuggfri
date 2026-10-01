import type { Metadata } from "next";
import type { ComponentType, ReactNode } from "react";
import {
  BookOpenText,
  CalendarClock,
  ChartNoAxesColumn,
  CircleHelp,
  Flag,
  GraduationCap,
  Gauge,
  Info,
  Keyboard,
  Layers,
  LifeBuoy,
  Radar,
  Rocket,
  Route,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  Star,
  Target,
  UserRound,
  Volume2,
  type LucideProps,
} from "lucide-react";
import type { Dict } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { SELF_RATINGS, type SelfRating } from "@/lib/progress/types";
import { ActionList, ActionRow } from "@/components/ui/ActionRow";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { cx } from "@/components/ui/cx";
import { ContactCards } from "@/components/layout/ContactCards";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.help.title };
}

type Icon = ComponentType<LucideProps>;

/** Sidans avsnitt i ordning: ger både innehållsförteckningen och ankarna. */
const SECTIONS = [
  { id: "kom-igang", key: "start", icon: Rocket },
  { id: "schemat", key: "schedule", icon: Route },
  { id: "lagen", key: "modes", icon: Layers },
  { id: "skattning", key: "rating", icon: Gauge },
  { id: "tangentbord", key: "keys", icon: Keyboard },
  { id: "under-passet", key: "session", icon: SlidersHorizontal },
  { id: "hemsidan", key: "home", icon: Radar },
  { id: "statistik", key: "stats", icon: ChartNoAxesColumn },
  { id: "konto", key: "account", icon: UserRound },
  { id: "fragor", key: "faq", icon: CircleHelp },
  { id: "mer-hjalp", key: "more", icon: LifeBuoy },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * Lägena i samma ordning och med samma ikoner som på kursens sida (ModePicker). Sedan
 * 30 sep 2026 räknas varje skattning in i schemat i alla lägen, så alla får samma märke.
 */
function modes(sv: Dict): ReadonlyArray<{ title: string; body: string; icon: Icon }> {
  const t = sv.help;
  return [
    { title: sv.deck.modeFsrs, body: t.modes.fsrs, icon: CalendarClock },
    { title: sv.deck.modeTricky, body: t.modes.tricky, icon: Target },
    { title: sv.deck.modeFree, body: t.modes.free, icon: BookOpenText },
    { title: sv.deck.modeRandom, body: t.modes.random, icon: Shuffle },
    { title: sv.deck.modeExam, body: t.modes.exam, icon: GraduationCap },
  ];
}

/**
 * Samma toner som skattningsknapparna (RatingButtons). Klasserna skrivs ut här i stället
 * för att importeras: den modulen är en klientkomponent och sidan renderas på servern.
 */
const RATE_SWATCH: Record<SelfRating, string> = {
  1: "bg-rate-1/20 border-rate-1",
  2: "bg-rate-2/20 border-rate-2",
  3: "bg-rate-3/20 border-rate-3",
  4: "bg-rate-4/20 border-rate-4",
  5: "bg-rate-5/20 border-rate-5",
};

function sessionTools(t: Dict["help"]): ReadonlyArray<{ icon: Icon; title: string; body: string }> {
  return [
    { icon: Info, ...t.sessionTools.info },
    { icon: Volume2, ...t.sessionTools.sound },
    { icon: Flag, ...t.sessionTools.report },
    { icon: Star, ...t.sessionTools.star },
  ];
}

/** En tangent som den ser ut på tangentbordet. */
function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-7 min-w-7 items-center justify-center rounded-sm border border-b-2 border-line-strong bg-surface-2 px-2 font-mono text-sm font-semibold text-fg">
      {children}
    </kbd>
  );
}

/** Ikonrutan till vänster om rubriker och handlingar. */
function IconChip({ icon: Icon, tone = "accent" }: { icon: Icon; tone?: "accent" | "neutral" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
        tone === "accent" ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-fg dark:bg-surface-3",
      )}
    >
      <Icon size={19} />
    </span>
  );
}

async function HelpSection({ id, lead, children }: { id: SectionId; lead?: string; children: ReactNode }) {
  const t = (await getT()).help;
  const section = SECTIONS.find((s) => s.id === id)!;
  return (
    // scroll-mt: ankarlänkarna ska inte landa under mobilens toppmeny.
    <section id={id} aria-labelledby={`${id}-rubrik`} className="scroll-mt-24">
      <div className="mb-4 flex items-center gap-3">
        <IconChip icon={section.icon} />
        <h2 id={`${id}-rubrik`} className="text-xl font-bold tracking-tight sm:text-2xl">
          {t.sections[section.key]}
        </h2>
      </div>
      {lead ? <p className="mb-5 max-w-prose leading-relaxed text-muted">{lead}</p> : null}
      {children}
    </section>
  );
}

export default async function HelpPage() {
  const sv = await getT();
  const t = sv.help;
  return (
    <article className="mx-auto w-full max-w-[46rem]">
      <header className="anim-fade-up mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">{t.lead}</p>
      </header>

      <nav aria-labelledby="innehall-rubrik" className="anim-fade-up mb-12" style={{ ["--i" as string]: 1 }}>
        <h2 id="innehall-rubrik" className="mb-3 text-sm font-semibold text-muted">
          {t.tocLabel}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex items-center rounded-full bg-surface-2 px-3.5 py-1.5 text-sm font-medium text-fg transition-colors duration-150 hover:bg-surface-3"
              >
                {t.sections[s.key]}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-14">
        <HelpSection id="kom-igang">
          <ol className="grid gap-3 sm:grid-cols-2">
            {t.startSteps.map((step, i) => (
              <li key={step.title}>
                <Card className="flex h-full gap-4">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-fg"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </HelpSection>

        <HelpSection id="schemat" lead={t.scheduleLead}>
          <Card padding="lg">
            <dl className="grid gap-5">
              {t.schedulePoints.map((point) => (
                <div key={point.title}>
                  <dt className="font-semibold">{point.title}</dt>
                  <dd className="mt-1 leading-relaxed text-muted">{point.body}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </HelpSection>

        <HelpSection id="lagen" lead={t.modesLead}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {modes(sv).map((m, i) => (
              <li key={m.title} className={cx(i === 0 && "sm:col-span-2")}>
                <Card className="flex h-full gap-4">
                  <IconChip icon={m.icon} tone={i === 0 ? "accent" : "neutral"} />
                  <div className="min-w-0">
                    <h3 className="font-semibold">{m.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{m.body}</p>
                    <div className="mt-3">
                      <Badge tone="accent">{t.affectsSchedule}</Badge>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </HelpSection>

        <HelpSection id="skattning" lead={t.ratingLead}>
          <Card padding="lg">
            <ul className="grid gap-4">
              {SELF_RATINGS.map((r) => (
                <li key={r} className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className={cx("inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 text-xl font-extrabold text-fg", RATE_SWATCH[r])}
                  >
                    {r}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <span className="sr-only">{r} – </span>
                      {sv.study.rate[r]}
                    </p>
                    <p className="text-sm leading-relaxed text-muted">{t.rating[r]}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <p className="mt-4 text-sm leading-relaxed text-muted">{t.ratingNote}</p>
        </HelpSection>

        <HelpSection id="tangentbord" lead={t.keysLead}>
          <Card padding="lg">
            <dl className="grid gap-4">
              {(
                [
                  [<Kbd key="k">{t.keys.space}</Kbd>, t.keys.flip],
                  [
                    <span key="k" className="inline-flex items-center gap-1.5">
                      <Kbd>1</Kbd>
                      <span aria-hidden="true" className="text-muted">
                        –
                      </span>
                      <span className="sr-only">{sv.help.keysTo}</span>
                      <Kbd>5</Kbd>
                    </span>,
                    t.keys.rate,
                  ],
                  [
                    <span key="k" className="inline-flex items-center gap-1.5">
                      <Kbd>←</Kbd>
                      <Kbd>→</Kbd>
                    </span>,
                    t.keys.nav,
                  ],
                  [<Kbd key="k">H</Kbd>, t.keys.hint],
                  [
                    <span key="k" className="inline-flex items-center gap-1.5">
                      <Kbd>1</Kbd>
                      <span aria-hidden="true" className="text-muted">
                        –
                      </span>
                      <span className="sr-only">{sv.help.keysTo}</span>
                      <Kbd>9</Kbd>
                    </span>,
                    t.keys.pick,
                  ],
                  [<Kbd key="k">Enter</Kbd>, t.keys.answer],
                ] as const
              ).map(([keys, action]) => (
                <div key={action} className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <dt className="w-36 shrink-0">{keys}</dt>
                  <dd className="leading-relaxed">{action}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </HelpSection>

        <HelpSection id="under-passet" lead={t.sessionLead}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {sessionTools(t).map((tool) => (
              <li key={tool.title}>
                <Card className="flex h-full gap-4">
                  <IconChip icon={tool.icon} tone="neutral" />
                  <div className="min-w-0">
                    <h3 className="font-semibold">{tool.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{tool.body}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </HelpSection>

        <HelpSection id="hemsidan">
          <Card padding="lg" className="grid gap-3 leading-relaxed">
            <p>{t.homeBody}</p>
            <p className="text-muted">{t.homeRadar}</p>
          </Card>
        </HelpSection>

        <HelpSection id="statistik" lead={t.statsBody}>
          <ActionList>
            <ActionRow href={routes.myStats()} icon={ChartNoAxesColumn} title={t.statsLink} />
          </ActionList>
        </HelpSection>

        <HelpSection id="konto" lead={t.accountBody}>
          <ActionList>
            <ActionRow href={routes.account()} icon={UserRound} title={t.accountLink} meta={t.accountLinkMeta} />
            <ActionRow href={routes.privacy()} icon={ShieldCheck} title={t.privacyLink} meta={t.privacyLinkMeta} />
          </ActionList>
        </HelpSection>

        <HelpSection id="fragor">
          <Card padding="none" className="divide-y divide-line px-5 py-2 sm:px-6">
            {t.faq.map((item) => (
              <Disclosure key={item.q} summary={item.q} className="py-2">
                <p className="pb-2 leading-relaxed text-muted">{item.a}</p>
              </Disclosure>
            ))}
          </Card>
        </HelpSection>

        <HelpSection id="mer-hjalp" lead={t.moreBody}>
          <ContactCards />
        </HelpSection>
      </div>
    </article>
  );
}
