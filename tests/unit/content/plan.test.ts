import { describe, expect, it } from "vitest";
import { planSync, courseFromSnapshot, EMPTY_SNAPSHOT, type DeckSnapshot, type SyncPayload } from "@/lib/content/plan";
import { cardId, categoryId, deckId, type ContentCard, type ContentCourse } from "@/lib/content/model";
import { deriveKey } from "@/lib/content/store";

// ---------------------------------------------------------------------------
// Hjälpare: bygg kurser och simulera vad sync_deck gör med databasen
// ---------------------------------------------------------------------------

function card(key: string, front: string, back: string, extra: Partial<ContentCard> = {}): ContentCard {
  return { key, front, back, hint: null, active: true, ...extra };
}

function course(categories: { key: string; title: string; cards: ContentCard[] }[]): ContentCourse {
  return {
    key: "kurs",
    title: "Kursen",
    description: null,
    course_code: "ABC123",
    source_credit: null,
    exam_date: null,
    published: true,
    sort_order: 0,
    categories: categories.map((c) => ({ ...c, file: `${c.key}.md` })),
  };
}

/** Samma verkan som public.sync_deck, så att idempotens kan testas. */
function applySync(snapshot: DeckSnapshot, sync: SyncPayload, id: string): DeckSnapshot {
  const next: DeckSnapshot = {
    deck: snapshot.deck ? { ...snapshot.deck } : null,
    categories: snapshot.categories.map((c) => ({ ...c })),
    cards: snapshot.cards.map((c) => ({ ...c })),
    progress: { ...snapshot.progress },
  };
  if (sync.deck) {
    next.deck = {
      id,
      slug: sync.deck.slug,
      title: sync.deck.title,
      description: sync.deck.description,
      course_code: sync.deck.course_code,
      source_credit: sync.deck.source_credit,
      exam_date: sync.deck.exam_date,
      is_published: sync.deck.is_published,
      sort_order: sync.deck.sort_order,
      source_hash: sync.deck.source_hash,
    };
  }
  for (const c of sync.categories.create) next.categories.push({ ...c });
  for (const c of sync.categories.update) {
    const row = next.categories.find((x) => x.id === c.id);
    if (row) Object.assign(row, c);
  }
  next.categories = next.categories.filter((c) => !sync.categories.delete.includes(c.id));
  for (const c of sync.cards.create) next.cards.push({ ...c, is_active: c.is_active });
  for (const c of sync.cards.update) {
    const row = next.cards.find((x) => x.id === c.id);
    if (row) Object.assign(row, c);
  }
  for (const id2 of sync.cards.deactivate) {
    const row = next.cards.find((x) => x.id === id2);
    if (row) row.is_active = false;
  }
  next.cards = next.cards.filter((c) => !sync.cards.delete.includes(c.id));
  for (const id2 of sync.cards.delete) delete next.progress[id2];
  return next;
}

/** Kursen synkad till en tom databas. */
function synced(c: ContentCourse): DeckSnapshot {
  const plan = planSync(c, EMPTY_SNAPSHOT);
  return applySync(EMPTY_SNAPSHOT, plan.sync, plan.deckId);
}

const BAS = course([
  { key: "kat-a", title: "Kategori A", cards: [card("k1", "Fråga 1", "Svar 1"), card("k2", "Fråga 2", "Svar 2")] },
  { key: "kat-b", title: "Kategori B", cards: [card("k3", "Fråga 3", "Svar 3")] },
]);

describe("planSync", () => {
  it("tom databas: skapar deck, kategorier och kort med deterministiska id:n", () => {
    const plan = planSync(BAS, EMPTY_SNAPSHOT);
    expect(plan.deckId).toBe(deckId("kurs"));
    expect(plan.sync.deck?.slug).toBe("kurs");
    expect(plan.sync.categories.create).toHaveLength(2);
    expect(plan.sync.cards.create).toHaveLength(3);
    expect(plan.conflicts).toEqual([]);
    expect(plan.empty).toBe(false);

    const first = plan.sync.cards.create[0];
    expect(first?.id).toBe(cardId("kurs", "k1"));
    expect(first?.category_id).toBe(categoryId("kurs", "kat-a"));
    // Global ordning över hela kursen, inte per kategori.
    expect(plan.sync.cards.create.map((c) => c.sort_order)).toEqual([0, 1, 2]);
  });

  it("är idempotent: andra körningen ger en tom plan", () => {
    const db = synced(BAS);
    const plan = planSync(BAS, db);
    expect(plan.changes).toEqual([]);
    expect(plan.empty).toBe(true);
  });

  it("ändring i filen ger en uppdatering utan att id:t ändras", () => {
    const db = synced(BAS);
    const ändrad = course([
      { key: "kat-a", title: "Kategori A", cards: [card("k1", "Fråga 1", "Nytt svar"), card("k2", "Fråga 2", "Svar 2")] },
      { key: "kat-b", title: "Kategori B", cards: [card("k3", "Fråga 3", "Svar 3")] },
    ]);
    const plan = planSync(ändrad, db);
    expect(plan.sync.cards.update).toHaveLength(1);
    expect(plan.sync.cards.update[0]?.id).toBe(cardId("kurs", "k1"));
    expect(plan.sync.cards.update[0]?.back).toBe("Nytt svar");
    expect(plan.changes.map((c) => c.kind)).toEqual(["card-update"]);
  });

  it("ändring i admin lämnas i fred och ber om pull", () => {
    const db = synced(BAS);
    const row = db.cards.find((c) => c.key === "k1");
    if (row) row.back = "Rättat av examinatorn";

    const plan = planSync(BAS, db);
    expect(plan.sync.cards.update).toHaveLength(0);
    expect(plan.warnings.join(" ")).toContain("ändrat i admin");
    expect(plan.empty).toBe(true);
  });

  it("ändrat i både fil och admin är en konflikt, som --tvinga löser till filens fördel", () => {
    const db = synced(BAS);
    const row = db.cards.find((c) => c.key === "k1");
    if (row) row.back = "Rättat av examinatorn";
    const ändrad = course([
      { key: "kat-a", title: "Kategori A", cards: [card("k1", "Fråga 1", "Nytt svar från filen"), card("k2", "Fråga 2", "Svar 2")] },
      { key: "kat-b", title: "Kategori B", cards: [card("k3", "Fråga 3", "Svar 3")] },
    ]);

    const plan = planSync(ändrad, db);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.sync.cards.update).toHaveLength(0);

    const tvingad = planSync(ändrad, db, { force: true });
    expect(tvingad.conflicts).toEqual([]);
    expect(tvingad.sync.cards.update[0]?.back).toBe("Nytt svar från filen");
  });

  it("kort som tagits bort ur filen inaktiveras, eller raderas med --radera", () => {
    const db = synced(BAS);
    db.progress[cardId("kurs", "k2")] = 12;
    const utan = course([
      { key: "kat-a", title: "Kategori A", cards: [card("k1", "Fråga 1", "Svar 1")] },
      { key: "kat-b", title: "Kategori B", cards: [card("k3", "Fråga 3", "Svar 3")] },
    ]);

    const mjuk = planSync(utan, db);
    expect(mjuk.sync.cards.deactivate).toEqual([cardId("kurs", "k2")]);
    expect(mjuk.sync.cards.delete).toEqual([]);
    expect(mjuk.changes.find((c) => c.kind === "card-deactivate")?.progress).toBe(12);

    const hård = planSync(utan, db, { deleteMissing: true });
    expect(hård.sync.cards.delete).toEqual([cardId("kurs", "k2")]);
    expect(hård.sync.cards.deactivate).toEqual([]);

    // Efter inaktivering är planen stabil (kortet inaktiveras inte om och om igen).
    const efter = applySync(db, mjuk.sync, mjuk.deckId);
    expect(planSync(utan, efter).empty).toBe(true);
  });

  it("kort skapade i admin rörs aldrig", () => {
    const db = synced(BAS);
    db.cards.push({
      id: "11111111-1111-4111-8111-111111111111",
      key: null,
      category_id: categoryId("kurs", "kat-a"),
      front: "Tillagt i admin",
      back: "Svar",
      hint: null,
      sort_order: 99,
      is_active: true,
      source_hash: null,
    });

    const plan = planSync(BAS, db);
    expect(plan.sync.cards.deactivate).toEqual([]);
    expect(plan.sync.cards.delete).toEqual([]);
    expect(plan.warnings.join(" ")).toContain("bara i databasen");
    // Inte heller med --radera.
    expect(planSync(BAS, db, { deleteMissing: true }).sync.cards.delete).toEqual([]);
  });

  it("adopterar befintliga rader utan nyckel via kategori och framsida, med id och progress intakt", () => {
    // Databas som seedades före pipelinen: id från gamla namnrymden, ingen nyckel eller hash.
    const legacyId = "22222222-2222-4222-8222-222222222222";
    const legacyCategoryId = "33333333-3333-4333-8333-333333333333";
    const db: DeckSnapshot = {
      deck: {
        id: deckId("kurs"),
        slug: "kurs",
        title: "Kursen",
        description: null,
        course_code: "ABC123",
        source_credit: null,
        exam_date: null,
        is_published: true,
        sort_order: 0,
        source_hash: null,
      },
      categories: [{ id: legacyCategoryId, key: null, title: "Kategori A", sort_order: 0, source_hash: null }],
      cards: [
        {
          id: legacyId,
          key: null,
          category_id: legacyCategoryId,
          front: "Fråga 1",
          back: "Svar 1",
          hint: null,
          sort_order: 0,
          is_active: true,
          source_hash: null,
        },
      ],
      progress: { [legacyId]: 30 },
    };
    const liten = course([{ key: "kat-a", title: "Kategori A", cards: [card("k1", "Fråga 1", "Svar 1")] }]);

    const plan = planSync(liten, db);
    expect(plan.sync.cards.create).toHaveLength(0);
    expect(plan.sync.cards.update).toHaveLength(1);
    // Det gamla id:t behålls, så progressen följer med.
    expect(plan.sync.cards.update[0]?.id).toBe(legacyId);
    expect(plan.sync.cards.update[0]?.key).toBe("k1");
    expect(plan.sync.categories.update[0]?.id).toBe(legacyCategoryId);
    expect(plan.changes.map((c) => c.kind)).toContain("card-adopt");

    const efter = applySync(db, plan.sync, plan.deckId);
    expect(efter.progress[legacyId]).toBe(30);
    expect(planSync(liten, efter).empty).toBe(true);
  });

  it("byte av kategori räknas som innehåll, ren omordning som flytt, aldrig nya kort", () => {
    const db = synced(BAS);
    const flyttad = course([
      { key: "kat-a", title: "Kategori A", cards: [card("k1", "Fråga 1", "Svar 1")] },
      { key: "kat-b", title: "Kategori B", cards: [card("k3", "Fråga 3", "Svar 3"), card("k2", "Fråga 2", "Svar 2")] },
    ]);
    const plan = planSync(flyttad, db);
    expect(plan.sync.cards.create).toHaveLength(0);
    expect(plan.sync.cards.update).toHaveLength(2);
    // k2 byter kategori (innehåll), k3 byter bara plats i ordningen.
    expect(plan.changes.find((c) => c.key === "k2")?.kind).toBe("card-update");
    expect(plan.changes.find((c) => c.key === "k3")?.kind).toBe("card-move");
    const k2 = plan.sync.cards.update.find((c) => c.key === "k2");
    expect(k2?.category_id).toBe(categoryId("kurs", "kat-b"));
    expect(k2?.sort_order).toBe(2);

    const efter = applySync(db, plan.sync, plan.deckId);
    expect(planSync(flyttad, efter).empty).toBe(true);
  });

  it("en lucka i databasens numrering efter en radering i admin ger inga falsklarm", () => {
    const db = synced(BAS);
    // Examinatorn raderar ett kort i admin: de följande korten behåller sina sort_order,
    // så numreringen får en lucka (0, 2). Det ska inte tolkas som en ändring i admin.
    db.cards = db.cards.filter((c) => c.key !== "k1");
    const utanK1 = course([
      { key: "kat-a", title: "Kategori A", cards: [card("k2", "Fråga 2", "Svar 2")] },
      { key: "kat-b", title: "Kategori B", cards: [card("k3", "Fråga 3", "Svar 3")] },
    ]);
    const plan = planSync(utanK1, db);
    expect(plan.warnings).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    // Bara ren omnumrering, inget innehåll rörs.
    expect(plan.changes.every((c) => c.kind === "card-move")).toBe(true);
  });

  it("tom kategori som saknas i filerna raderas, en med kort lämnas kvar med varning", () => {
    const db = synced(BAS);
    const utanB = course([{ key: "kat-a", title: "Kategori A", cards: [card("k1", "Fråga 1", "Svar 1"), card("k2", "Fråga 2", "Svar 2")] }]);

    const mjuk = planSync(utanB, db);
    expect(mjuk.sync.categories.delete).toEqual([]);
    expect(mjuk.warnings.join(" ")).toContain("har kvar 1 kort");

    const hård = planSync(utanB, db, { deleteMissing: true });
    expect(hård.sync.categories.delete).toEqual([categoryId("kurs", "kat-b")]);
  });

  it("kursens uppgifter uppdateras från kurs.json", () => {
    const db = synced(BAS);
    const plan = planSync({ ...BAS, exam_date: "2026-10-27", title: "Nytt namn" }, db);
    expect(plan.sync.deck?.exam_date).toBe("2026-10-27");
    expect(plan.sync.deck?.title).toBe("Nytt namn");
    expect(plan.changes.map((c) => c.kind)).toEqual(["deck-update"]);
  });
});

describe("courseFromSnapshot (pull)", () => {
  it("ger tillbaka kursen med nycklar för rader som skapats i admin", () => {
    const db = synced(BAS);
    db.cards.push({
      id: "44444444-4444-4444-8444-444444444444",
      key: null,
      category_id: categoryId("kurs", "kat-a"),
      front: "Tillagt i admin",
      back: "Svar från admin",
      hint: "Ledtråd",
      sort_order: 1,
      is_active: true,
      source_hash: null,
    });

    const pulled = courseFromSnapshot(db, BAS, deriveKey);
    const katA = pulled.categories.find((c) => c.key === "kat-a");
    expect(katA?.file).toBe("kat-a.md");
    // Lika sort_order avgörs av ordningen i snapshoten (created_at i databasen): nyast sist.
    expect(katA?.cards.map((c) => c.key)).toEqual(["k1", "k2", "tillagt-i-admin"]);
    expect(katA?.cards[2]?.hint).toBe("Ledtråd");

    // Efter pull är planen tom: filerna och databasen är i fas.
    const plan = planSync(pulled, db);
    expect(plan.conflicts).toEqual([]);
    expect(plan.sync.cards.create).toHaveLength(0);
    expect(plan.sync.cards.deactivate).toHaveLength(0);
  });

  it("kort utan kategori hamnar i en egen fil i stället för att tappas", () => {
    const db = synced(BAS);
    db.cards.push({
      id: "55555555-5555-4555-8555-555555555555",
      key: null,
      category_id: null,
      front: "Hemlöst kort",
      back: "Svar",
      hint: null,
      sort_order: 50,
      is_active: true,
      source_hash: null,
    });
    const pulled = courseFromSnapshot(db, BAS, deriveKey);
    const sista = pulled.categories[pulled.categories.length - 1];
    expect(sista?.key).toBe("utan-kategori");
    expect(sista?.cards.map((c) => c.front)).toEqual(["Hemlöst kort"]);
  });
});

describe("efter pull", () => {
  it("en ändring från admin bekräftas utan att innehållet rörs, och planen blir tom", () => {
    const db = synced(BAS);
    // Examinatorn rättar kortet i admin.
    const row = db.cards.find((c) => c.key === "k1");
    if (row) row.back = "Rättat i admin";

    // pull tar in ändringen i filerna.
    const pulled = courseFromSnapshot(db, BAS, deriveKey);
    const plan = planSync(pulled, db);
    expect(plan.conflicts).toEqual([]);
    expect(plan.changes.map((c) => c.kind)).toEqual(["card-sync"]);
    expect(plan.sync.cards.update[0]?.back).toBe("Rättat i admin");

    const efter = applySync(db, plan.sync, plan.deckId);
    expect(planSync(pulled, efter).empty).toBe(true);
  });
});
