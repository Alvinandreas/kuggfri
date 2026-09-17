import Link from "next/link";
import type { Metadata } from "next";
import { sv } from "@/lib/i18n/sv";
import { getAdminContext } from "@/lib/admin/access";
import { getAllDecksForAdmin } from "@/lib/admin/queries";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: sv.admin.decks };

export default async function AdminDeckListPage() {
  const [decks, ctx] = await Promise.all([getAllDecksForAdmin(), getAdminContext()]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{sv.admin.decks}</h1>
        {ctx?.isAdmin ? (
          <LinkButton href="/admin/deck/ny" size="sm">
            {sv.admin.newDeck}
          </LinkButton>
        ) : null}
      </div>
      {decks.length === 0 ? (
        <p className="text-muted">{sv.admin.noDecks}</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2" data-testid="admin-deck-list">
          {decks.map((d) => (
            <li key={d.id} className="relative flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4 transition-colors hover:bg-surface-2">
              <div className="min-w-0">
                <Link href={`/admin/deck/${d.id}`} className="font-semibold after:absolute after:inset-0 after:rounded-lg">
                  {d.title}
                </Link>
                <p className="text-sm text-muted">
                  {d.course_code ? `${d.course_code} · ` : ""}
                  {sv.home.cards(d.cardCount)} · <span className={d.is_published ? "text-accent" : ""}>{d.is_published ? sv.admin.published : sv.admin.unpublished}</span>
                </p>
              </div>
              <Link href={`/d/${d.slug}`} className="relative z-10 text-sm text-muted hover:text-fg">
                {sv.admin.viewDeck}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
