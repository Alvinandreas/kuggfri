import { NextResponse } from "next/server";
import { canEditDeck, getAdminContext } from "@/lib/admin/access";
import { isUuid } from "@/lib/admin/action-helpers";
import { getCardHistory } from "@/lib/admin/history-queries";

/**
 * Ett korts historik som JSON, för granskningsvyn som hämtar den när ett kort visas. En
 * vanlig GET i stället för en serveråtgärd, så att hämtningen inte köar bakom besluten.
 * Samma åtkomst som adminsidorna; RLS på card_versions nekar dessutom oavsett.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  const { id, cardId } = await params;
  if (!isUuid(id) || !isUuid(cardId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ctx = await getAdminContext();
  if (!canEditDeck(ctx, id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const versions = await getCardHistory(id, cardId);
    return NextResponse.json({ versions }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
