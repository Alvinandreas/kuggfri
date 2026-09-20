/**
 * Mejlinnehåll. Ren modul (inga beroenden på server eller databas) så att den kan testas.
 * Tonen följer docs/OMVARLDSANALYS.md: ett mejl med faktiskt värde, aldrig skuld.
 */
import { daysUntil, estimateMinutes, parseExamDate } from "@/lib/study/plan";
import { firstLine } from "@/lib/text/first-line";
import type { DeckDigest } from "@/lib/supabase/database.types";

export type ReminderDeck = { slug: string; title: string; due: number; exam_date: string | null };

export type Email = { subject: string; text: string; html: string };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function layout(title: string, paragraphs: string[], footer: string): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#1d1c19">${p}</p>`).join("");
  return `<!doctype html><html lang="sv"><body style="margin:0;background:#f6f5f1;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><h1 style="margin:0 0 18px;font-size:22px;color:#1d1c19">${esc(title)}</h1>${body}<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#676259">${footer}</p></div></body></html>`;
}

function examLine(exam: string | null, now: Date): string | null {
  const d = parseExamDate(exam);
  if (!d) return null;
  const days = daysUntil(d, now);
  if (days < 0) return null;
  if (days === 0) return "Tentan är i dag.";
  if (days === 1) return "Tentan är i morgon.";
  return `Tentan om ${days} dagar.`;
}

export function buildReminderEmail(input: { name: string | null; decks: ReminderDeck[]; siteUrl: string; now?: Date }): Email {
  const now = input.now ?? new Date();
  const total = input.decks.reduce((s, d) => s + d.due, 0);
  const minutes = estimateMinutes(total);
  const first = input.decks[0];
  const subject =
    input.decks.length === 1 && first
      ? `${first.due} kort att repetera i ${first.title} · cirka ${minutes} min`
      : `${total} kort att repetera · cirka ${minutes} min`;
  const hello = input.name ? `Hej ${input.name}!` : "Hej!";
  const lines: string[] = [];
  const htmlLines: string[] = [];
  for (const d of input.decks) {
    const url = `${input.siteUrl}/d/${d.slug}/plugga?mode=fsrs&urval=all`;
    const exam = examLine(d.exam_date, now);
    const line = `${d.title}: ${d.due === 1 ? "1 kort" : `${d.due} kort`} att repetera, cirka ${estimateMinutes(d.due)} min.${exam ? ` ${exam}` : ""}`;
    lines.push(`${line}\n${url}`);
    htmlLines.push(`${esc(line)}<br><a href="${url}" style="color:#1f7a4d">Starta passet</a>`);
  }
  const footerText = "Du får högst ett mejl per dag, bara när det finns kort att repetera, och inget efter tentan. Stäng av under Konto på kuggfri.com.";
  const text = [hello, "", ...lines, "", footerText].join("\n");
  const html = layout(hello, htmlLines, `${esc(footerText)} <a href="${input.siteUrl}/konto" style="color:#676259">Konto</a>`);
  return { subject, text, html };
}

export function buildReminderStopEmail(input: { name: string | null; siteUrl: string }): Email {
  const hello = input.name ? `Hej ${input.name}!` : "Hej!";
  const body = "Du har inte repeterat på två veckor, så vi slutar skicka påminnelser. Inget illa ment: de ska hjälpa, inte tjata. Vill du ha dem igen slår du på dem under Konto.";
  return {
    subject: "Vi slutar skicka påminnelser",
    text: [hello, "", body, "", `${input.siteUrl}/konto`].join("\n"),
    html: layout(hello, [esc(body)], `<a href="${input.siteUrl}/konto" style="color:#676259">Konto på kuggfri.com</a>`),
  };
}

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
}): Email {
  const { data } = input;
  const now = input.now ?? new Date();
  const hello = input.name ? `Hej ${input.name}!` : "Hej!";
  const hardest = data.hardest[0];
  const subject = `Veckobrev ${input.deckTitle}: ${data.active_7d} aktiva studenter${hardest ? `, svårast ${hardest.title}` : ""}`;
  const exam = examLine(data.exam_date, now);

  const paras: string[] = [];
  paras.push(
    `Senaste sju dagarna: ${data.active_7d} aktiva studenter av ${data.students} som börjat (${data.new_students_7d} nya), ${data.reviews_7d} repetitioner${
      data.avg_rating_7d !== null ? `, snittskattning ${data.avg_rating_7d.toFixed(1)} av 5` : ""
    }.${exam ? ` ${exam}` : ""}`,
  );
  if (data.hardest.length > 0) {
    paras.push(`Svåraste områdena (snittskattning): ${data.hardest.map((h) => `${h.title} ${h.avg.toFixed(1)}`).join(" · ")}.`);
  } else {
    paras.push(`Svåraste områdena visas när minst ${input.minStudents} studenter skattat en kategori.`);
  }
  if (data.tricky.length > 0) {
    paras.push(`Kluriga frågor (andel som skattade 1–2): ${data.tricky.map((t) => `”${firstLine(t.front, { maxLength: 90 })}” ${Math.round(t.low_share * 100)} %`).join(" · ")}.`);
  }
  if (data.open_reports > 0) {
    paras.push(
      `${data.open_reports === 1 ? "1 öppen felrapport" : `${data.open_reports} öppna felrapporter`}${
        data.latest_reports.length > 0 ? `: ${data.latest_reports.map((r) => `”${firstLine(r.front, { maxLength: 90 })}”: ${r.message.slice(0, 120)}`).join(" · ")}` : ""
      }.`,
    );
  } else {
    paras.push("Inga öppna felrapporter.");
  }
  const url = `${input.siteUrl}/admin/deck/${input.deckId}`;
  const footerText = `Allt är sammanställt och anonymt; inget visas per kategori eller kort förrän minst ${input.minStudents} studenter skattat. Veckobrevet kan stängas av under Konto.`;
  const text = [hello, "", ...paras, "", `Kursöversikten: ${url}`, "", footerText].join("\n");
  const html = layout(
    `Veckobrev: ${input.deckTitle}`,
    [esc(hello), ...paras.map(esc), `<a href="${url}" style="color:#1f7a4d">Öppna kursöversikten</a>`],
    esc(footerText),
  );
  return { subject, text, html };
}

/** Beslut per student: skicka påminnelse, skicka sista mejlet och stäng av, eller ingenting. */
export const REMINDER_STOP_AFTER = 14;

export function decideReminder(input: { sentToday: boolean; remindersSinceLastReview: number; due: number }): "send" | "stop" | "skip" {
  if (input.sentToday) return "skip";
  if (input.remindersSinceLastReview >= REMINDER_STOP_AFTER) return "stop";
  if (input.due <= 0) return "skip";
  return "send";
}
