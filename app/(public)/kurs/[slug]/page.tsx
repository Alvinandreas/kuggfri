import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { getDeckBySlug } from "@/lib/content/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { AuthPanel } from "@/components/auth/AuthForms";
import { Badge } from "@/components/ui/Badge";
import { routes } from "@/lib/routes";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getDeckBySlug(slug);
  if (!data) return { title: sv.landing.title };
  const description = data.deck.description ?? sv.deck.totalCards(data.cards.length);
  return { title: data.deck.title, description, openGraph: { title: data.deck.title, description } };
}

/**
 * Inbjudan till en kurs: det en utloggad ser på en kurslänk /d/<slug> (middleware skriver
 * om hit utan att adressen ändras). Kursens namn och beskrivning, och formuläret som
 * leder rakt in i kursen.
 */
export default async function CourseInvitePage({ params }: { params: Params }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (user) redirect(routes.deck(slug));
  // Utloggad: bara publicerade kurser hittas, så en opublicerad kurs läcker inte ens sitt namn.
  const data = await getDeckBySlug(slug);
  if (!data) notFound();
  const { deck, cards } = data;

  return (
    <div className="grid items-center gap-10 py-4 lg:min-h-[calc(100dvh-13rem)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
      <div className="anim-fade-up">
        <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-ink">{sv.invite.eyebrow}</p>
        <div className="mt-6 flex items-center gap-4">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
            <BookOpen size={28} aria-hidden />
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{deck.title}</h1>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {deck.course_code ? <Badge tone="outline">{deck.course_code}</Badge> : null}
          <Badge>{sv.deck.totalCards(cards.length)}</Badge>
        </div>
        {deck.description ? <p className="mt-5 max-w-xl text-lg text-muted">{deck.description}</p> : null}
        <p className="mt-5 max-w-xl text-muted">{sv.invite.lead}</p>
      </div>
      <AuthPanel next={routes.deck(deck.slug)} initialTab="registrera" />
    </div>
  );
}
