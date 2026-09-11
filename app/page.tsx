import Link from "next/link";
import { sv } from "@/lib/i18n/sv";
import { getPublishedDecks } from "@/lib/content/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const decks = await getPublishedDecks();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{sv.home.title}</h1>
      <p className="mt-2 text-muted">{sv.home.lead}</p>

      {decks.length === 0 ? (
        <p className="mt-10 rounded-lg border border-line bg-surface p-6 text-muted">{sv.home.empty}</p>
      ) : (
        <ul className="mt-8 grid gap-3">
          {decks.map((deck) => (
            <li key={deck.id}>
              <Link
                href={`/d/${deck.slug}`}
                className="block rounded-lg border border-line bg-surface p-5 shadow-card transition-colors hover:border-line-strong"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold">{deck.title}</h2>
                  <span className="shrink-0 text-sm text-muted">{sv.home.cards(deck.cardCount)}</span>
                </div>
                {deck.course_code ? (
                  <p className="mt-1 text-sm text-muted">
                    {sv.home.courseCode} {deck.course_code}
                  </p>
                ) : null}
                {deck.description ? <p className="mt-2 text-muted">{deck.description}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
