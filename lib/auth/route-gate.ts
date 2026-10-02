import { routes } from "@/lib/routes";

/**
 * Vilka adresser når man utan konto? Sedan Kuggfri 2.0 krävs konto för att plugga
 * (DECISIONS.md, 27 september 2026). Utloggade når bara landningssidan, inloggnings-
 * flödet, kursinbjudningarna och de informationssidor som måste vara läsbara innan man
 * registrerar sig.
 *
 * Delningsbilderna (opengraph-image) är publika med flit: chattklienter hämtar dem utan
 * inloggning, och det är så en kurslänk visar en förhandsvisning i en gruppchatt.
 * API-vägarna skyddar sig själva (cron- och revalideringshemlighet, kontokontroll).
 */
const PUBLIC_EXACT = new Set(["/", "/logga-in", "/registrera", "/glomt-losenord", "/bekrafta", "/om", "/hjalp", "/integritet", "/manifest.webmanifest", "/robots.txt"]);

const PUBLIC_PREFIXES = ["/auth/", "/api/", "/kurs/"];

/** /opengraph-image och /kurs/<slug>/opengraph-image, med eller utan Next.js cache-suffix (-a1b2c3). */
const OG_IMAGE = /^(?:\/kurs\/[^/]+)?\/opengraph-image(?:-[A-Za-z0-9]+)?$/;

/** En kurslänk: /d/<slug>, utan undersida. */
const COURSE_LINK = /^\/d\/([^/]+)\/?$/;

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return OG_IMAGE.test(pathname);
}

/**
 * En utloggad som öppnar en kurslänk får inbjudningssidan för kursen på samma adress
 * (omskrivning, inte omdirigering): länken i gruppchatten visar kursens namn och bild,
 * och efter registreringen landar studenten i kursen. Null för allt annat.
 */
export function inviteRewriteTarget(pathname: string): string | null {
  const m = COURSE_LINK.exec(pathname);
  return m?.[1] ? routes.courseInvite(m[1]) : null;
}

/** Vart en utloggad besökare skickas: landningssidan, med ursprungsadressen som next. */
export function loginRedirectTarget(pathname: string, search: string): string {
  const next = `${pathname}${search}`;
  return next === "/" ? routes.landing() : routes.landing({ next });
}
