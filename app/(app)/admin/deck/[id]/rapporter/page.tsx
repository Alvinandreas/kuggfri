import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLang, getT } from "@/lib/i18n/server";
import { cardFront } from "@/lib/admin/display";
import { getDeckForAdmin, getDeckReports } from "@/lib/admin/queries";
import { ReportList } from "@/components/admin/ReportList";

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.admin.reports };
}

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const sv = await getT();
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const lang = await getLang();
  const front = new Map(data.cards.map((c) => [c.id, cardFront(c, lang)] as const));
  const reports = (await getDeckReports(id)).map((r) => ({ ...r, card_front: front.get(r.card_id) ?? r.card_front }));
  const open = reports.filter((r) => r.status === "open");
  const resolved = reports.filter((r) => r.status !== "open");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1">
        <h2 className="text-xl font-bold tracking-tight">{sv.admin.reports}</h2>
        <p className="text-sm text-muted">{sv.admin.reportsHelp}</p>
      </div>

      <section aria-labelledby="oppna" className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <h2 id="oppna" className="text-lg font-bold tracking-tight">
          {sv.admin.reportsOpen} ({open.length})
        </h2>
        <ReportList deckId={id} reports={open} />
      </section>

      {resolved.length > 0 ? (
        <section aria-labelledby="atgardade" className="grid grid-cols-[minmax(0,1fr)] gap-3">
          <h2 id="atgardade" className="text-lg font-bold tracking-tight">
            {sv.admin.reportsResolved} ({resolved.length})
          </h2>
          <ReportList deckId={id} reports={resolved} />
        </section>
      ) : null}
    </div>
  );
}
