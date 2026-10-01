import { NextResponse } from "next/server";
import { getDeckForAdmin, getDeckOverviewStats, getDeckStats } from "@/lib/admin/queries";
import { areaStatsCsv, cardStatsCsv } from "@/lib/admin/stats-csv";
import { stockholmDayKey } from "@/lib/time/stockholm";

/**
 * Statistiken som CSV (lib/admin/stats-csv): `?niva=omraden` ger en rad per område, annars en rad
 * per publicerat kort. Samma behörighet som resten av admin (getDeckForAdmin), och samma
 * anonymitetsgräns som översikten: databasen släpper bara igenom det som passerat den.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const areas = data.categories.map((c) => ({ id: c.id, title: c.title }));
  const perArea = new URL(request.url).searchParams.get("niva") === "omraden";
  let body: string;
  if (perArea) {
    const overview = await getDeckOverviewStats(id);
    body = areaStatsCsv(areas, data.cards, overview.categories);
  } else {
    const [stats, overview] = await Promise.all([getDeckStats(id), getDeckOverviewStats(id)]);
    const low = new Map(overview.cards.map((c) => [c.card_id, c.low] as const));
    body = cardStatsCsv(
      areas,
      data.cards,
      stats.cards
        .filter((c) => c.rating_count > 0)
        .map((c) => ({ card_id: c.card_id, ratings: c.rating_count, avg: c.avg_rating, low: low.get(c.card_id) ?? null, reps: c.total_reps })),
    );
  }

  const name = `${data.deck.slug}-statistik-${perArea ? "omraden" : "kort"}-${stockholmDayKey(new Date())}.csv`;
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
