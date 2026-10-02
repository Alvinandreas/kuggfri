import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getMyDecks } from "@/lib/content/queries";
import { Badge } from "@/components/ui/Badge";
import { Card, CardLink } from "@/components/ui/Card";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.home.title };
}

export default async function CoursesPage() {
  const sv = await getT();
  const decks = await getMyDecks();
  // Med en enda kurs finns inget att välja mellan: gå direkt till den.
  if (decks.length === 1 && decks[0]) redirect(routes.deck(decks[0].slug));

  return (
    <div>
      <header className="anim-fade-up mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{sv.home.title}</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">{sv.home.lead}</p>
      </header>

      {decks.length === 0 ? (
        <Card padding="lg" className="text-muted">
          {sv.home.empty}
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {decks.map((deck, i) => (
            <li key={deck.id} className="anim-fade-up" style={{ ["--i" as string]: i + 1 }}>
              <CardLink href={routes.deck(deck.slug)} padding="lg" className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                    <BookOpen size={22} aria-hidden />
                  </span>
                  {deck.course_code ? <Badge tone="outline">{deck.course_code}</Badge> : null}
                </div>
                <h2 className="mt-5 text-xl font-bold tracking-tight">{deck.title}</h2>
                <p className="mt-1 text-sm text-muted">{sv.home.cards(deck.cardCount)}</p>
                {deck.description ? <p className="mt-3 line-clamp-3 text-muted">{deck.description}</p> : null}
                <p className="mt-auto inline-flex items-center gap-1.5 pt-6 font-semibold text-accent">
                  {sv.dashboard.openCourse}
                  <ArrowRight size={16} aria-hidden className="transition-transform duration-200 group-hover:translate-x-1" />
                </p>
              </CardLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
