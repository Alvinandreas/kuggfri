import { describe, expect, it } from "vitest";
import { buildDigestEmail } from "@/lib/email/templates";

const NOW = new Date(2026, 9, 18, 17, 0, 0); // 18 okt 2026, lokal tid

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
    expect(e.text).toContain("Kristallstruktur 2.9; Dislokationer 3.1");
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

  it("på engelska med områdenas och kortens engelska namn, och svenska där översättning saknas", () => {
    const en = {
      ...data,
      hardest: [
        { title: "Kristallstruktur", title_en: "Crystal structure", avg: 2.9, students: 31 },
        { title: "Dislokationer", title_en: null, avg: 3.1, students: 28 },
      ],
      tricky: [{ front: "Vad är en eutektisk reaktion?", front_en: "What is a eutectic reaction?", low_share: 0.41, ratings: 27 }],
      latest_reports: [{ front: "Brottseghet", front_en: "Fracture toughness", message: "Formeln saknar kvadratrot", created_at: "2026-10-17T10:00:00Z" }],
    };
    const e = buildDigestEmail({ name: "Roland", deckTitle: "Materialteknik", deckId: "deck-1", data: en, minStudents: 5, siteUrl: "https://kuggfri.com", now: NOW, lang: "en" });
    expect(e.subject).toBe("Weekly summary Materialteknik: 44 active students, hardest Crystal structure");
    expect(e.text).toContain("Hi Roland,");
    expect(e.text).toContain("44 active students of 61 who have started (9 new), 2310 reviews, average rating 3.6 of 5. The exam is in 9 days.");
    expect(e.text).toContain("Crystal structure 2.9; Dislokationer 3.1");
    expect(e.text).toContain("“What is a eutectic reaction?” 41%");
    expect(e.text).toContain("2 open error reports: “Fracture toughness”: Formeln saknar kvadratrot");
    expect(e.html).toContain('lang="en"');
    expect(e.html).toContain("Open the course overview");
    expect(e.text).not.toMatch(/Veckobrev|aktiva|Kursöversikten/);
  });

  it("svenska som standard, också när engelska namn finns", () => {
    const e = buildDigestEmail({ name: "Johan", deckTitle: "Materialteknik", deckId: "deck-1", data: { ...data, hardest: [{ title: "Kristallstruktur", title_en: "Crystal structure", avg: 2.9, students: 31 }] }, minStudents: 5, siteUrl: "https://kuggfri.com", now: NOW });
    expect(e.subject).toBe("Veckobrev Materialteknik: 44 aktiva studenter, svårast Kristallstruktur");
    expect(e.html).toContain('lang="sv"');
  });
});
