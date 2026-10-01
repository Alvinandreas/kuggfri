import type { Args } from "./args";
import type { Target } from "./db";
import { C, dim, say } from "./output";

/**
 * Rensar sajtens cache för publikt innehåll efter en apply. Pipelinen skriver direkt till
 * databasen, så Next.js vet annars inte att innehållet ändrats (fem minuters cache).
 * Kräver CRON_SECRET; saknas den skrivs bara en upplysning.
 */
export async function revalidate(args: Args, target: Target): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET ?? process.env.CRON_SECRET;
  const site =
    (typeof args.flags.sajt === "string" ? args.flags.sajt : undefined) ??
    (target.kind === "linked" ? process.env.NEXT_PUBLIC_SITE_URL ?? "https://kuggfri.com" : "http://localhost:3000");
  if (!secret) {
    say(dim(`Cachen rensas inom fem minuter. Sätt REVALIDATE_SECRET för att rensa direkt (${site}).`));
    return;
  }
  try {
    const res = await fetch(`${site.replace(/\/$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    if (res.ok) say(dim(`Cachen rensad på ${site}.`));
    else say(`${C.yellow}Kunde inte rensa cachen (${res.status}).${C.reset} Innehållet syns inom fem minuter ändå.`);
  } catch {
    say(dim("Kunde inte nå sajten för cacherensning. Innehållet syns inom fem minuter ändå."));
  }
}
