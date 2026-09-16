import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getDeckForAdmin, getDeckReports } from "@/lib/admin/queries";
import { ReportList } from "@/components/admin/ReportList";

export const metadata: Metadata = { title: sv.admin.reports };

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const reports = await getDeckReports(id);
  const open = reports.filter((r) => r.status === "open");
  const resolved = reports.filter((r) => r.status !== "open");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <Link href={`/admin/deck/${id}`} className="text-sm text-muted hover:text-fg">
          ← {data.deck.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {sv.admin.reports}: {data.deck.title}
        </h1>
        <p className="text-sm text-muted">{sv.admin.reportsHelp}</p>
      </div>

      <section aria-labelledby="oppna" className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <h2 id="oppna" className="text-lg font-semibold">
          {sv.admin.reportsOpen} ({open.length})
        </h2>
        <ReportList deckId={id} reports={open} />
      </section>

      {resolved.length > 0 ? (
        <section aria-labelledby="atgardade" className="grid grid-cols-[minmax(0,1fr)] gap-3">
          <h2 id="atgardade" className="text-lg font-semibold">
            {sv.admin.reportsResolved} ({resolved.length})
          </h2>
          <ReportList deckId={id} reports={resolved} />
        </section>
      ) : null}
    </div>
  );
}
