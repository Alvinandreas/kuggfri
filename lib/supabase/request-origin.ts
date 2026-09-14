import "server-only";
import { headers } from "next/headers";
import { getSiteUrl } from "./env";

/**
 * Den adress användaren faktiskt besöker (t.ex. https://kuggfri.vercel.app eller
 * https://kuggfri.com). Används som återvändsadress i e-postlänkar så att länken
 * alltid leder tillbaka till samma domän som registreringen gjordes på.
 * Faller tillbaka på NEXT_PUBLIC_SITE_URL om värdnamn saknas.
 */
export async function getRequestOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return getSiteUrl();
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return getSiteUrl();
  }
}
