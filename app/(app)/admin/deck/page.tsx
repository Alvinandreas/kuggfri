import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, BookOpen, Plus } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { getAdminContext } from "@/lib/admin/access";
import { getAllDecksForAdmin } from "@/lib/admin/queries";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: sv.admin.decks };

export default async function AdminDeckListPage() {
  const [decks, ctx] = await Promise.all([getAllDecksForAdmin(), getAdminContext()]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="anim-fade-up flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{sv.admin.decks}</h1>
        {ctx?.isAdmin ? (
          <LinkButton href="/admin/deck/ny" size="sm">
            <Plus size={16} aria-hidden />
            {sv.admin.newDeck}
          </LinkButton>
        ) : null}
      </div>
      {decks.length === 0 ? (
        <Card padding="lg" className="text-muted">
          {sv.admin.noDecks}
        </Card>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3" data-testid="admin-deck-list">
          {decks.map((d, i) => (
            <li
              key={d.id}
              className="anim-fade-up relative flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface p-5 transition-colors duration-150 hover:bg-surface-2 dark:border-transparent"
              style={{ ["--i" as string]: i + 1 }}
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                <BookOpen size={22} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                {/* Hela raden är klickbar via länkens ::after; "Visa kursen" ligger ovanpå (z-10). */}
                <Link href={`/admin/deck/${d.id}`} className="text-lg font-bold tracking-tight after:absolute after:inset-0 after:rounded-lg">
                  {d.title}
                </Link>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                  {d.course_code ? <Badge tone="outline">{d.course_code}</Badge> : null}
                  <span>{sv.admin.activeCardCount(d.cardCount)}</span>
                  <Badge tone={d.is_published ? "accent" : "neutral"}>{d.is_published ? sv.admin.published : sv.admin.unpublished}</Badge>
                </p>
              </div>
              <Link
                href={`/d/${d.slug}`}
                className="relative z-10 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-muted transition-colors duration-150 hover:bg-surface-3 hover:text-fg"
              >
                {sv.admin.viewDeck}
                <ArrowUpRight size={15} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
