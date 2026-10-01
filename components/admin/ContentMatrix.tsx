import Link from "next/link";
import { sv } from "@/lib/i18n/sv";
import { CARD_KINDS, CARD_KIND_LABEL } from "@/lib/cards/kinds";
import type { ContentMatrix as Matrix, MatrixRow } from "@/lib/admin/review";
import { categoryColorIndex } from "@/lib/ui/tag-colors";
import { Card, CardHeader } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";
import { AreaLink } from "./AreaLink";
import { routes } from "@/lib/routes";

const th = "py-3 text-xs font-semibold text-subtle";
/** Första kolumnen står kvar när tabellen scrollar i sidled; bakgrunden följer radens hovring. */
const stickyCell = "sticky left-0 z-10 bg-surface transition-colors duration-150 group-hover:bg-surface-2";

/**
 * Innehållsöversikten: område × uppgiftstyp med antal aktiva kort, en kolumn för utkast
 * som väntar (länk till granskningen, filtrerad på området) och en summarad. Samma form som
 * tabellen över de svåraste områdena i Översikt: områdena som färgade taggar som leder till
 * områdets sida. Tabellen scrollar i sidled inom blocket på smala skärmar.
 */
export function ContentMatrix({ deckId, matrix }: { deckId: string; matrix: Matrix }) {
  const reviewHref = (areaId: string | null) => routes.admin.review(deckId, { omrade: areaId ?? "ingen" });
  const areaName = (row: MatrixRow) => row.title ?? sv.admin.uncategorized;
  const colorIndex = categoryColorIndex(matrix.rows.flatMap((r) => (r.areaId ? [{ id: r.areaId }] : [])));

  return (
    <Card padding="lg" className="anim-fade-up" data-testid="content-matrix">
      <CardHeader id="innehallsoversikt" title={sv.admin.matrixTitle} description={sv.admin.matrixHelp} />
      <div className="-mx-6 overflow-x-auto sm:-mx-7" tabIndex={0} role="region" aria-labelledby="innehallsoversikt">
        <table className="w-full min-w-[40rem] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className={cx(th, "sticky left-0 z-10 bg-surface pl-6 pr-4 sm:pl-7")}>
                {sv.admin.matrixArea}
              </th>
              {CARD_KINDS.map((k) => (
                <th key={k} scope="col" className={cx(th, "px-3 text-right")}>
                  {CARD_KIND_LABEL[k]}
                </th>
              ))}
              <th scope="col" className={cx(th, "px-3 text-right")}>
                {sv.admin.matrixActive}
              </th>
              <th scope="col" className={cx(th, "pl-3 pr-6 text-right sm:pr-7")}>
                {sv.admin.matrixDrafts}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {matrix.rows.map((row) => (
              <tr key={row.areaId ?? "ingen"} className="group transition-colors duration-150 hover:bg-surface-2">
                <th scope="row" className={cx(stickyCell, "max-w-[18rem] py-2.5 pl-6 pr-4 text-left font-medium sm:pl-7")}>
                  {row.areaId ? (
                    <AreaLink deckId={deckId} areaId={row.areaId} title={areaName(row)} colorIndex={colorIndex.get(row.areaId) ?? 0} />
                  ) : (
                    <Link href={routes.admin.category(deckId, "ingen")} className="inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted ring-fg/25 transition-shadow duration-150 hover:ring-2">
                      {areaName(row)}
                    </Link>
                  )}
                </th>
                {CARD_KINDS.map((k) => (
                  <Cell key={k} value={row.byKind[k]} />
                ))}
                <Cell value={row.active} strong />
                <td className="py-2.5 pl-3 pr-6 text-right sm:pr-7">
                  <DraftCount n={row.drafts} href={reviewHref(row.areaId)} label={sv.admin.matrixDraftsLink(row.drafts, areaName(row))} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong font-bold">
              <th scope="row" className="sticky left-0 z-10 bg-surface py-3 pl-6 pr-4 text-left sm:pl-7">
                {sv.admin.matrixTotal}
              </th>
              {CARD_KINDS.map((k) => (
                <td key={k} className="px-3 py-3 text-right">
                  {matrix.total.byKind[k]}
                </td>
              ))}
              <td className="px-3 py-3 text-right">{matrix.total.active}</td>
              <td className="py-3 pl-3 pr-6 text-right sm:pr-7">
                <DraftCount n={matrix.total.drafts} href={routes.admin.review(deckId)} label={sv.admin.draftCount(matrix.total.drafts)} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function Cell({ value, strong = false }: { value: number; strong?: boolean }) {
  return <td className={cx("px-3 py-2.5 text-right", value === 0 ? "text-subtle/70" : strong ? "font-bold" : "")}>{value}</td>;
}

/** Utkasten som en pill som leder till granskningen, filtrerad på området. */
function DraftCount({ n, href, label }: { n: number; href: string; label: string }) {
  if (n === 0)
    return (
      <span className="text-subtle/70" aria-label={sv.admin.matrixNoDrafts}>
        0
      </span>
    );
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-6 min-w-8 items-center justify-center rounded-full bg-accent-soft px-2.5 text-xs font-bold text-accent-ink transition-colors duration-150 hover:bg-accent hover:text-accent-fg"
    >
      {n}
    </Link>
  );
}
