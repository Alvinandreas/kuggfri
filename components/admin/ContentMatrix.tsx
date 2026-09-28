import Link from "next/link";
import { sv } from "@/lib/i18n/sv";
import { CARD_KINDS, CARD_KIND_LABEL } from "@/lib/cards/kinds";
import type { ContentMatrix as Matrix, MatrixRow } from "@/lib/admin/review";
import { Card, CardHeader } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";

/**
 * Innehållsöversikten: område × uppgiftstyp med antal aktiva kort, en kolumn för utkast
 * som väntar (länk till granskningen, filtrerad på området) och en summarad. Tabellen
 * scrollar i sidled inom blocket på smala skärmar; områdesnamnet står kvar till vänster.
 */
export function ContentMatrix({ deckId, matrix }: { deckId: string; matrix: Matrix }) {
  const reviewHref = (areaId: string | null) => `/admin/deck/${deckId}/granskning?omrade=${areaId ?? "ingen"}`;
  const areaName = (row: MatrixRow) => row.title ?? sv.admin.uncategorized;

  return (
    <Card padding="md" className="anim-fade-up" data-testid="content-matrix">
      <CardHeader title={sv.admin.matrixTitle} description={sv.admin.matrixHelp} spacing="sm" />
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="sticky left-0 z-10 bg-surface py-2 pr-3 font-semibold">
                {sv.admin.matrixArea}
              </th>
              {CARD_KINDS.map((k) => (
                <th key={k} scope="col" className="px-2 py-2 text-right font-semibold">
                  {CARD_KIND_LABEL[k]}
                </th>
              ))}
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                {sv.admin.matrixActive}
              </th>
              <th scope="col" className="py-2 pl-2 text-right font-semibold">
                {sv.admin.matrixDrafts}
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.areaId ?? "ingen"} className="group">
                <th scope="row" className="sticky left-0 z-10 max-w-[14rem] truncate border-t border-line bg-surface py-2 pr-3 text-left font-medium">
                  {row.areaId ? (
                    <Link href={`/admin/deck/${deckId}/kategori/${row.areaId}`} className="hover:underline">
                      {areaName(row)}
                    </Link>
                  ) : (
                    <span className="text-muted">{areaName(row)}</span>
                  )}
                </th>
                {CARD_KINDS.map((k) => (
                  <Cell key={k} value={row.byKind[k]} />
                ))}
                <Cell value={row.active} strong />
                <td className="border-t border-line py-2 pl-2 text-right">
                  <DraftCount n={row.drafts} href={reviewHref(row.areaId)} label={sv.admin.matrixDraftsLink(row.drafts, areaName(row))} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <th scope="row" className="sticky left-0 z-10 border-t-2 border-line-strong bg-surface py-2 pr-3 text-left">
                {sv.admin.matrixTotal}
              </th>
              {CARD_KINDS.map((k) => (
                <td key={k} className="border-t-2 border-line-strong px-2 py-2 text-right">
                  {matrix.total.byKind[k]}
                </td>
              ))}
              <td className="border-t-2 border-line-strong px-2 py-2 text-right">{matrix.total.active}</td>
              <td className="border-t-2 border-line-strong py-2 pl-2 text-right">
                <DraftCount n={matrix.total.drafts} href={`/admin/deck/${deckId}/granskning`} label={sv.admin.draftCount(matrix.total.drafts)} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function Cell({ value, strong = false }: { value: number; strong?: boolean }) {
  return <td className={cx("border-t border-line px-2 py-2 text-right", value === 0 ? "text-subtle" : strong ? "font-semibold" : "")}>{value}</td>;
}

function DraftCount({ n, href, label }: { n: number; href: string; label: string }) {
  if (n === 0) return <span className="text-subtle">0</span>;
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-inverse px-2 text-xs font-bold text-inverse-fg transition-opacity duration-150 hover:opacity-85"
    >
      {n}
    </Link>
  );
}
