import { NextResponse } from "next/server";
import { getDeckForAdmin } from "@/lib/admin/queries";

/**
 * Bulkexport till JSON. Formatet kan importeras rakt av igen
 * (fältet cards med category som titel).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const categoryTitle = new Map(data.categories.map((c) => [c.id, c.title] as const));
  const body = {
    exported_at: new Date().toISOString(),
    deck: {
      slug: data.deck.slug,
      title: data.deck.title,
      description: data.deck.description,
      course_code: data.deck.course_code,
      source_credit: data.deck.source_credit,
      is_published: data.deck.is_published,
    },
    categories: data.categories.map((c) => ({ title: c.title, sort_order: c.sort_order })),
    cards: data.cards.map((c) => ({
      front: c.front,
      back: c.back,
      hint: c.hint,
      category: c.category_id ? (categoryTitle.get(c.category_id) ?? null) : null,
      sort_order: c.sort_order,
      is_active: c.is_active,
    })),
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${data.deck.slug}.json"`,
      "cache-control": "no-store",
    },
  });
}
