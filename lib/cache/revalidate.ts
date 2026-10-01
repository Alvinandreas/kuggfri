import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { CONTENT_TAG } from "@/lib/content/queries";
import { routes } from "@/lib/routes";

/** Vad serveråtgärderna tömmer i cachen efter en ändring, samlat på ett ställe. */

/** Ett decks innehåll eller inställningar har ändrats. */
export function revalidateDeck(deckId: string, slug?: string) {
  revalidateTag(CONTENT_TAG);
  revalidatePath(routes.admin.home());
  revalidatePath(routes.admin.decks());
  revalidatePath(routes.admin.deck(deckId), "layout");
  revalidatePath(routes.landing());
  if (slug) {
    revalidatePath(routes.deck(slug));
    revalidatePath(routes.study(slug));
  }
}

/** Ett deck har tagits bort. */
export function revalidateDeckRemoved() {
  revalidateTag(CONTENT_TAG);
  revalidatePath(routes.admin.home());
  revalidatePath(routes.admin.decks());
  revalidatePath(routes.landing());
}

/** Felrapporterna för ett deck. */
export function revalidateReports(deckId: string) {
  revalidatePath(routes.admin.deck(deckId));
  revalidatePath(routes.admin.reports(deckId));
}

/** Deckets inställningar med examinatorerna. */
export function revalidateExaminers(deckId: string) {
  revalidatePath(routes.admin.settings(deckId));
}

/** En tentas sidor efter ett försök. */
export function revalidateExam(slug: string, key: string) {
  revalidatePath(routes.exam(slug));
  revalidatePath(routes.examAttempt(slug, key));
}

/** Tentaläget för studenterna (redaktörens studentvy). */
export function revalidateExamPages(slug: string) {
  revalidatePath(routes.exam(slug), "layout");
}

/** Tentaläget har öppnats eller låsts. */
export function revalidateExamMode(deckId: string, slug: string) {
  revalidateDeck(deckId, slug);
  revalidateExamPages(slug);
  revalidatePath(routes.admin.exams(deckId), "layout");
}
