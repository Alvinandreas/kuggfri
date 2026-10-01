import { redirect } from "next/navigation";
import { pickActiveAdminCourse } from "@/lib/admin/active-course";
import { getEditableDecks } from "@/lib/admin/queries";
import { routes } from "@/lib/routes";

/**
 * Ingången till admin. Adminfunktionerna gäller Materialteknik (lib/admin/active-course.ts,
 * beslut 30 sep 2026): den som får redigera kursen hamnar direkt i dess översikt, även när
 * databasen har andra kurser. Den som bara får redigera ett annat deck hamnar i det decket;
 * med flera andra visas listan.
 */
export default async function AdminPage() {
  const target = pickActiveAdminCourse(await getEditableDecks(), "enda");
  if (target) redirect(routes.admin.deck(target.id));
  redirect(routes.admin.decks());
}
