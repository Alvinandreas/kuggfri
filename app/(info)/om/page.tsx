import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, LifeBuoy } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { getDecksForAbout } from "@/lib/content/queries";
import { Logo } from "@/components/layout/Logo";
import { ActionList, ActionRow } from "@/components/ui/ActionRow";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: sv.about.title };

/**
 * Om Kuggfri: vad tjänsten är, varför den finns, kurserna och vem som står bakom.
 * Hur man använder den står på /hjalp.
 *
 * Löptexten. Rubrikens avstånd uppåt kommer från .prose-body (globals.css) och ligger
 * utanför Tailwinds lager; här läggs bara det till som prose-body inte redan styr.
 */
const sectionClass = "prose-body [&_h2]:tracking-tight [&_a]:underline-offset-2";

export default async function AboutPage() {
  const decks = await getDecksForAbout();
  return (
    <article className="mx-auto w-full max-w-[46rem]">
      <header className="anim-fade-up mb-4">
        <Logo height={64} decorative />
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">{sv.about.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">{sv.about.intro}</p>
      </header>

      <div className="grid gap-3">
        <section className={sectionClass}>
          <h2>{sv.about.why}</h2>
          <p>{sv.about.whyBody}</p>
        </section>

        {/* Länken till hjälpen ligger utanför .prose-body, som annars färgar och stryker under den. */}
        <section>
          <div className={sectionClass}>
            <h2>{sv.about.how}</h2>
            <p>{sv.about.howBody}</p>
          </div>
          <ActionList className="mt-4">
            <ActionRow href="/hjalp" icon={LifeBuoy} title={sv.help.fromAbout} meta={sv.help.fromAboutMeta} />
          </ActionList>
        </section>

        {/* Kurslistan ligger utanför .prose-body, som annars ger listan punkter och indrag. */}
        <section>
          <div className={sectionClass}>
            <h2>{sv.about.sources}</h2>
            <p>{sv.about.sourcesBody}</p>
          </div>
          <ul className="mt-4 grid gap-3">
            {decks.map((d) => (
              <li key={d.id}>
                <Card className="flex items-start gap-4">
                  <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                    <BookOpen size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                      <Link href={`/d/${d.slug}`} className="underline decoration-line-strong underline-offset-2 hover:decoration-fg">
                        {d.title}
                      </Link>
                      {d.course_code ? <Badge tone="outline">{d.course_code}</Badge> : null}
                    </p>
                    <p className="mt-1 text-sm text-muted">{d.source_credit ?? sv.about.noSource}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {/* Samma uppgifter som i integritetspolicyn: ändras det ena ska det andra följa med. */}
        <section className={sectionClass}>
          <h2>Vem står bakom</h2>
          <p>
            Kuggfri byggs och drivs ideellt av en student vid Chalmers tekniska högskola. Tjänsten är inte en del av
            Chalmers IT-miljö. Frågor om en kurs innehåll ställer du till den som sammanställt kursen, se
            krediteringen ovan. Hittar du ett fel i ett enskilt kort rapporterar du det direkt från kortet, så
            hamnar det hos kursens examinator.
          </p>
        </section>

        <section>
          <div className={sectionClass}>
            <h2>{sv.about.teachers}</h2>
            <p>{sv.about.teachersIntro}</p>
          </div>
          <Card padding="lg" className="mt-4">
            <ul className="grid gap-3 leading-relaxed">
              {sv.about.teachersPoints.map((point) => (
                <li key={point} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="mt-4 leading-relaxed">{sv.about.teachersOutro}</p>
        </section>

        <section className={sectionClass}>
          <h2>{sv.about.privacy}</h2>
          <p>
            {sv.about.privacyBody}{" "}
            <Link href="/integritet" className="text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent">
              {sv.footer.privacy}
            </Link>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
