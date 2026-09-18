import { describe, expect, it } from "vitest";
import { buildDigestEmail, buildReminderEmail, buildReminderStopEmail, decideReminder } from "@/lib/email/templates";

const NOW = new Date(2026, 9, 18, 17, 0, 0); // 18 okt 2026, lokal tid

describe("påminnelse", () => {
  it("ett deck: ämnesrad med antal och tid, tentarad, länk och avstängningstext", () => {
    const e = buildReminderEmail({
      name: "Alvin",
      decks: [{ slug: "materialteknik", title: "Materialteknik", due: 14, exam_date: "2026-10-27" }],
      siteUrl: "https://kuggfri.com",
      now: NOW,
    });
    expect(e.subject).toBe("14 kort att repetera i Materialteknik · cirka 4 min");
    expect(e.text).toContain("Hej Alvin!");
    expect(e.text).toContain("Tentan om 9 dagar.");
    expect(e.text).toContain("https://kuggfri.com/d/materialteknik/plugga?mode=fsrs&urval=all");
    expect(e.text).toContain("högst ett mejl per dag");
    expect(e.html).toContain("Starta passet");
    expect(e.html).not.toContain("<script");
  });

  it("flera deck summeras i ämnesraden, utan tentarad när tentan passerat", () => {
    const e = buildReminderEmail({
      name: null,
      decks: [
        { slug: "a", title: "A", due: 3, exam_date: "2026-10-01" },
        { slug: "b", title: "B", due: 1, exam_date: null },
      ],
      siteUrl: "https://kuggfri.com",
      now: NOW,
    });
    expect(e.subject).toBe("4 kort att repetera · cirka 1 min");
    expect(e.text).toContain("Hej!");
    expect(e.text).not.toContain("Tentan");
    expect(e.text).toContain("B: 1 kort att repetera");
  });

  it("sista mejlet säger att påminnelserna stängs av, utan skuld", () => {
    const e = buildReminderStopEmail({ name: "Alvin", siteUrl: "https://kuggfri.com" });
    expect(e.subject).toBe("Vi slutar skicka påminnelser");
    expect(e.text).toContain("Inget illa ment");
    expect(e.text).toContain("https://kuggfri.com/konto");
  });

  it("beslutet: högst ett per dag, stopp efter 14 utan repetition, inget utan förfallna kort", () => {
    expect(decideReminder({ sentToday: true, remindersSinceLastReview: 0, due: 10 })).toBe("skip");
    expect(decideReminder({ sentToday: false, remindersSinceLastReview: 14, due: 10 })).toBe("stop");
    expect(decideReminder({ sentToday: false, remindersSinceLastReview: 3, due: 0 })).toBe("skip");
    expect(decideReminder({ sentToday: false, remindersSinceLastReview: 3, due: 5 })).toBe("send");
  });
});

describe("veckobrev", () => {
  const data = {
    exam_date: "2026-10-27",
    students: 61,
    new_students_7d: 9,
    active_7d: 44,
    reviews_7d: 2310,
    avg_rating_7d: 3.6,
    hardest: [
      { title: "Kristallstruktur", avg: 2.9, students: 31 },
      { title: "Dislokationer", avg: 3.1, students: 28 },
    ],
    tricky: [{ front: "Vad är en **eutektisk** reaktion?\nMer text", low_share: 0.41, ratings: 27 }],
    open_reports: 2,
    latest_reports: [{ front: "Brottseghet", message: "Formeln saknar kvadratrot", created_at: "2026-10-17T10:00:00Z" }],
  };

  it("sammanfattar veckan, svåraste områdena, kluriga frågor och felrapporter", () => {
    const e = buildDigestEmail({ name: "Johan", deckTitle: "Materialteknik", deckId: "deck-1", data, minStudents: 5, siteUrl: "https://kuggfri.com", now: NOW });
    expect(e.subject).toBe("Veckobrev Materialteknik: 44 aktiva studenter, svårast Kristallstruktur");
    expect(e.text).toContain("44 aktiva studenter av 61 som börjat (9 nya), 2310 repetitioner, snittskattning 3.6 av 5. Tentan om 9 dagar.");
    expect(e.text).toContain("Kristallstruktur 2.9 · Dislokationer 3.1");
    expect(e.text).toContain("”Vad är en eutektisk reaktion?” 41 %");
    expect(e.text).toContain("2 öppna felrapporter: ”Brottseghet”: Formeln saknar kvadratrot");
    expect(e.text).toContain("https://kuggfri.com/admin/deck/deck-1");
    expect(e.html).toContain("Öppna kursöversikten");
  });

  it("under anonymitetsgränsen förklaras varför inget visas", () => {
    const e = buildDigestEmail({
      name: null,
      deckTitle: "Ny kurs",
      deckId: "deck-2",
      data: { ...data, hardest: [], tricky: [], open_reports: 0, latest_reports: [], avg_rating_7d: null, exam_date: null },
      minStudents: 5,
      siteUrl: "https://kuggfri.com",
      now: NOW,
    });
    expect(e.subject).toBe("Veckobrev Ny kurs: 44 aktiva studenter");
    expect(e.text).toContain("visas när minst 5 studenter skattat");
    expect(e.text).toContain("Inga öppna felrapporter.");
    expect(e.text).not.toContain("snittskattning");
  });
});
