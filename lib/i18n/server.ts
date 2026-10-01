import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { dictionary } from "./index";
import { LANG_COOKIE, type Dict, type Lang } from "./types";

/**
 * Språket för den här förfrågan: engelska bara om cookien från reglaget English säger det,
 * annars svenska. Läses en gång per förfrågan (React cache).
 */
export const getLang = cache(async (): Promise<Lang> => {
  try {
    const store = await cookies();
    return store.get(LANG_COOKIE)?.value === "en" ? "en" : "sv";
  } catch {
    // Utanför en förfrågan (t.ex. cron eller ett skript): alltid svenska.
    return "sv";
  }
});

/** Ordlistan för den här förfrågan. I serverkomponenter: `const sv = await getT();`. */
export async function getT(): Promise<Dict> {
  return dictionary(await getLang());
}
