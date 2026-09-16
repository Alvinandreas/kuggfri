import Link from "next/link";
import type { Metadata } from "next";
import { sv } from "@/lib/i18n/sv";
import { getAllDecksForAdmin } from "@/lib/admin/queries";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: sv.admin.title };

export default async function AdminPage() {
  const decks = await getAllDecksForAdmin();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{sv.admin.decks}</h1>
        <LinkButton href="/admin/deck/ny" size="sm">
          {sv.admin.newDeck}
        </LinkButton>
      </div>
      {decks.length === 0 ? (
        <p className="text-muted">{sv.admin.noDecks}</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2" data-testid="admin-deck-list">
          {decks.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
              <div>
                <Link href={`/admin/deck/${d.id}`} className="font-semibold hover:underline">
                  {d.title}
                </Link>
                <p className="text-sm text-muted">
                  /d/{d.slug} · {sv.home.cards(d.cardCount)} ·{" "}
                  <span className={d.is_published ? "text-accent" : ""}>{d.is_published ? sv.admin.published : sv.admin.unpublished}</span>
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <Link href={`/admin/deck/${d.id}`} className="text-accent hover:underline">
                  {sv.common.edit}
                </Link>
                <Link href={`/admin/deck/${d.id}/statistik`} className="text-accent hover:underline">
                  {sv.admin.stats}
                </Link>
                <Link href={`/d/${d.slug}`} className="text-muted hover:text-fg">
                  {sv.admin.viewDeck}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
