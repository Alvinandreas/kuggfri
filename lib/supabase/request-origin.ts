import "server-only";
import { headers } from "next/headers";
import { getSiteUrl } from "./env";

/**
 * Den adress användaren faktiskt besöker. Används som återvändsadress i e-postlänkar så
 * att länken leder tillbaka till samma domän som registreringen gjordes på.
 *
 * Värdnamnet kommer från requestens headers och är därmed i princip påverkbart. Därför
 * godtas bara värdnamn på tillåtlistan: annars skulle någon kunna få en inloggnings- eller
 * återställningslänk att peka på sin egen domän och fånga upp token. Okända värdnamn faller
 * tillbaka på NEXT_PUBLIC_SITE_URL.
 */
export function isAllowedHost(host: string | null | undefined, siteUrl: string): boolean {
  if (!host) return false;
  const lower = host.toLowerCase();
  if (lower.startsWith("localhost:") || lower === "localhost") return true;
  if (lower.startsWith("127.0.0.1")) return true;
  let siteHost = "";
  try {
    siteHost = new URL(siteUrl).host.toLowerCase();
  } catch {
    siteHost = "";
  }
  const allowed = new Set<string>();
  if (siteHost) {
    allowed.add(siteHost);
    allowed.add(siteHost.startsWith("www.") ? siteHost.slice(4) : `www.${siteHost}`);
  }
  for (const extra of (process.env.ALLOWED_HOSTS ?? "").split(",")) {
    const trimmed = extra.trim().toLowerCase();
    if (trimmed) allowed.add(trimmed);
  }
  return allowed.has(lower);
}

export async function getRequestOrigin(): Promise<string> {
  const siteUrl = getSiteUrl();
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!isAllowedHost(host, siteUrl)) return siteUrl;
    const lower = (host ?? "").toLowerCase();
    const proto = lower.startsWith("localhost") || lower.startsWith("127.0.0.1") ? "http" : "https";
    return `${proto}://${host}`;
  } catch {
    return siteUrl;
  }
}
