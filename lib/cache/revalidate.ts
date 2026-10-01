import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { CONTENT_TAG } from "@/lib/content/queries";

/** Vad serveråtgärderna tömmer i cachen efter en ändring, samlat på ett ställe. */

/** Ett decks innehåll eller inställningar har ändrats. */
export function revalidateDeck(deckId: string, slug?: string) {
  revalidateTag(CONTENT_TAG);
  revalidatePath("/admin");
  revalidatePath("/admin/deck");
  revalidatePath(`/admin/deck/${deckId}`, "layout");
  revalidatePath("/");
  if (slug) {
    revalidatePath(`/d/${slug}`);
    revalidatePath(`/d/${slug}/plugga`);
  }
}

/** Ett deck har tagits bort. */
export function revalidateDeckRemoved() {
  revalidateTag(CONTENT_TAG);
  revalidatePath("/admin");
  revalidatePath("/admin/deck");
  revalidatePath("/");
}

/** Felrapporterna för ett deck. */
export function revalidateReports(deckId: string) {
  revalidatePath(`/admin/deck/${deckId}`);
  revalidatePath(`/admin/deck/${deckId}/rapporter`);
}

/** Deckets inställningar med examinatorerna. */
export function revalidateExaminers(deckId: string) {
  revalidatePath(`/admin/deck/${deckId}/installningar`);
}

/** En tentas sidor efter ett försök. */
export function revalidateExam(slug: string, key: string) {
  revalidatePath(`/d/${slug}/tenta`);
  revalidatePath(`/d/${slug}/tenta/${key}`);
}

/** Tentaläget för studenterna (redaktörens studentvy). */
export function revalidateExamPages(slug: string) {
  revalidatePath(`/d/${slug}/tenta`, "layout");
}

/** Tentaläget har öppnats eller låsts. */
export function revalidateExamMode(deckId: string, slug: string) {
  revalidateDeck(deckId, slug);
  revalidateExamPages(slug);
  revalidatePath(`/admin/deck/${deckId}/tentor`, "layout");
}
