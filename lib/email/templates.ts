/**
 * Mejlinnehåll. Ren modul (inga beroenden på server eller databas) så att den kan testas.
 * Tonen följer docs/OMVARLDSANALYS.md: ett mejl med faktiskt värde, aldrig skuld.
 */
import { daysUntil, parseExamDate } from "@/lib/study/plan";
import { firstLine } from "@/lib/text/first-line";
import type { DeckDigest } from "@/lib/supabase/database.types";
import { routes } from "@/lib/routes";

export type Email = { subject: string; text: string; html: string };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function layout(title: string, paragraphs: string[], footer: string, lang: DigestLang = "sv"): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#1d1c19">${p}</p>`).join("");
  return `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f6f5f1;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><h1 style="margin:0 0 18px;font-size:22px;color:#1d1c19">${esc(title)}</h1>${body}<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#676259">${footer}</p></div></body></html>`;
}

/** Veckobrevets språk: kontots val med reglaget English (profiles.lang). */
export type DigestLang = "sv" | "en";

function examLine(exam: string | null, now: Date, lang: DigestLang): string | null {
  const d = parseExamDate(exam);
  if (!d) return null;
  const days = daysUntil(d, now);
  if (days < 0) return null;
  if (lang === "en") return days === 0 ? "The exam is today." : days === 1 ? "The exam is tomorrow." : `The exam is in ${days} days.`;
  if (days === 0) return "Tentan är i dag.";
  if (days === 1) return "Tentan är i morgon.";
  return `Tentan om ${days} dagar.`;
}

/** Veckobrevets texter. Kursnamnet översätts inte (Alvins beslut 1 okt). */
const DIGEST_TEXT = {
  sv: {
    hello: (name: string | null) => (name ? `Hej ${name}!` : "Hej!"),
    subject: (deck: string, active: number, hardest: string | null) => `Veckobrev ${deck}: ${active} aktiva studenter${hardest ? `, svårast ${hardest}` : ""}`,
    title: (deck: string) => `Veckobrev: ${deck}`,
    week: (d: DigestData, avg: string | null, exam: string | null) =>
      `Senaste sju dagarna: ${d.active_7d} aktiva studenter av ${d.students} som börjat (${d.new_students_7d} nya), ${d.reviews_7d} repetitioner${avg !== null ? `, snittskattning ${avg} av 5` : ""}.${exam ? ` ${exam}` : ""}`,
    hardest: (list: string) => `Svåraste områdena (snittskattning): ${list}.`,
    hardestNone: (min: number) => `Svåraste områdena visas när minst ${min} studenter skattat en kategori.`,
    tricky: (list: string) => `Kluriga frågor (andel som skattade 1–2): ${list}.`,
    pct: (n: number) => `${n} %`,
    quote: (s: string) => `”${s}”`,
    reports: (n: number) => (n === 1 ? "1 öppen felrapport" : `${n} öppna felrapporter`),
    noReports: "Inga öppna felrapporter.",
    overview: "Kursöversikten",
    openOverview: "Öppna kursöversikten",
    footer: (min: number) => `Allt är sammanställt och anonymt; inget visas per kategori eller kort förrän minst ${min} studenter skattat. Veckobrevet kan stängas av under Konto.`,
  },
  en: {
    hello: (name: string | null) => (name ? `Hi ${name},` : "Hi,"),
    subject: (deck: string, active: number, hardest: string | null) => `Weekly summary ${deck}: ${active} active students${hardest ? `, hardest ${hardest}` : ""}`,
    title: (deck: string) => `Weekly summary: ${deck}`,
    week: (d: DigestData, avg: string | null, exam: string | null) =>
      `The last seven days: ${d.active_7d} active students of ${d.students} who have started (${d.new_students_7d} new), ${d.reviews_7d} reviews${avg !== null ? `, average rating ${avg} of 5` : ""}.${exam ? ` ${exam}` : ""}`,
    hardest: (list: string) => `Hardest topics (average rating): ${list}.`,
    hardestNone: (min: number) => `The hardest topics are shown once at least ${min} students have rated a topic.`,
    tricky: (list: string) => `Tricky questions (share rated 1–2): ${list}.`,
    pct: (n: number) => `${n}%`,
    quote: (s: string) => `“${s}”`,
    reports: (n: number) => (n === 1 ? "1 open error report" : `${n} open error reports`),
    noReports: "No open error reports.",
    overview: "Course overview",
    openOverview: "Open the course overview",
    footer: (min: number) => `Everything is aggregated and anonymous; nothing is shown per topic or card until at least ${min} students have rated it. The weekly summary can be turned off under Account.`,
  },
} as const;

/**
 * Underlaget till veckobrevet är exakt det deck_digest() returnerar. Ett alias i stället
 * för en egen kopia, så att ett nytt fält i SQL-funktionen inte kan falla bort tyst i mejlet.
 */
export type DigestData = DeckDigest;



export function buildDigestEmail(input: {
  name: string | null;
  deckTitle: string;
  deckId: string;
  data: DigestData;
  minStudents: number;
  siteUrl: string;
  now?: Date;
  /** Kontots språk; engelska använder områdenas och kortens engelska namn där de finns. */
  lang?: DigestLang;
}): Email {
  const { data } = input;
  const lang = input.lang ?? "sv";
  const t = DIGEST_TEXT[lang];
  const now = input.now ?? new Date();
  const area = (h: DigestData["hardest"][number]) => (lang === "en" && h.title_en ? h.title_en : h.title);
  const front = (c: { front: string; front_en?: string | null }) => firstLine(lang === "en" && c.front_en ? c.front_en : c.front, { maxLength: 90 });
  const hello = t.hello(input.name);
  const hardest = data.hardest[0];
  const subject = t.subject(input.deckTitle, data.active_7d, hardest ? area(hardest) : null);
  const exam = examLine(data.exam_date, now, lang);

  const paras: string[] = [];
  paras.push(t.week(data, data.avg_rating_7d !== null ? data.avg_rating_7d.toFixed(1) : null, exam));
  if (data.hardest.length > 0) {
    paras.push(t.hardest(data.hardest.map((h) => `${area(h)} ${h.avg.toFixed(1)}`).join("; ")));
  } else {
    paras.push(t.hardestNone(input.minStudents));
  }
  if (data.tricky.length > 0) {
    paras.push(t.tricky(data.tricky.map((c) => `${t.quote(front(c))} ${t.pct(Math.round(c.low_share * 100))}`).join("; ")));
  }
  if (data.open_reports > 0) {
    paras.push(
      `${t.reports(data.open_reports)}${
        data.latest_reports.length > 0 ? `: ${data.latest_reports.map((r) => `${t.quote(front(r))}: ${r.message.slice(0, 120)}`).join("; ")}` : ""
      }.`,
    );
  } else {
    paras.push(t.noReports);
  }
  const url = `${input.siteUrl}${routes.admin.deck(input.deckId)}`;
  const footerText = t.footer(input.minStudents);
  const text = [hello, "", ...paras, "", `${t.overview}: ${url}`, "", footerText].join("\n");
  const html = layout(t.title(input.deckTitle), [esc(hello), ...paras.map(esc), `<a href="${url}" style="color:#1f7a4d">${t.openOverview}</a>`], esc(footerText), lang);
  return { subject, text, html };
}
