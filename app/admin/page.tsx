import { redirect } from "next/navigation";
import { getAllDecksForAdmin } from "@/lib/admin/queries";

/**
 * Ingången till admin. Den som får redigera exakt ett deck (typfallet: en
 * examinator för sin kurs, eller admin så länge tjänsten har ett deck) hamnar
 * direkt i kursöversikten. Annars visas listan.
 */
export default async function AdminPage() {
  const decks = await getAllDecksForAdmin();
  if (decks.length === 1) redirect(`/admin/deck/${decks[0]!.id}`);
  redirect("/admin/deck");
}
