import { safeNext } from "./safe-next";

/**
 * Nyckeln i användarens metadata där registreringen sparar vart man ska efter bekräftelsen
 * (t.ex. kursen man fick länk till). Bekräftelsemejlet har en fast länk, så målet kan inte
 * följa med i mejlet; /auth/confirm läser det härifrån i stället.
 */
export const SIGNUP_NEXT_KEY = "signup_next";

/** Målet efter bekräftelsen, eller null om det saknas, är ogiltigt eller bara pekar på startsidan. */
export function signupNextFromMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.[SIGNUP_NEXT_KEY];
  const next = safeNext(value, "");
  return next && next !== "/" ? next : null;
}
