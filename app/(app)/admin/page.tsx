import { redirect } from "next/navigation";
import { ACTIVE_ADMIN_COURSE_SLUG } from "@/lib/admin/active-course";
import { getAllDecksForAdmin } from "@/lib/admin/queries";

/**
 * Ingången till admin. Adminfunktionerna gäller Materialteknik (lib/admin/active-course.ts,
 * beslut 30 sep 2026): den som får redigera kursen hamnar direkt i dess översikt, även när
 * databasen har andra kurser. Den som bara får redigera ett annat deck hamnar i det decket;
 * med flera andra visas listan.
 */
export default async function AdminPage() {
  const decks = await getAllDecksForAdmin();
  const target = decks.find((d) => d.slug === ACTIVE_ADMIN_COURSE_SLUG) ?? (decks.length === 1 ? decks[0] : undefined);
  if (target) redirect(`/admin/deck/${target.id}`);
  redirect("/admin/deck");
}
