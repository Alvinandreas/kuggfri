import "server-only";
import { cache } from "react";
import { getCurrentProfile } from "@/lib/supabase/server";
import { dictionary } from "./index";
import type { Dict, Lang } from "./types";

/**
 * Språket för den här förfrågan: kontots val under Konto → Språk (profiles.lang), alltså samma på
 * alla enheter. Utloggad: svenska. Läses en gång per förfrågan (React cache); profilen hämtas
 * ändå för skalet, så det kostar ingen extra fråga.
 */
export const getLang = cache(async (): Promise<Lang> => {
  try {
    const session = await getCurrentProfile();
    return session?.profile?.lang === "en" ? "en" : "sv";
  } catch {
    // Utanför en förfrågan (t.ex. cron eller ett skript): alltid svenska.
    return "sv";
  }
});

/** Ordlistan för den här förfrågan. I serverkomponenter: `const sv = await getT();`. */
export async function getT(): Promise<Dict> {
  return dictionary(await getLang());
}
