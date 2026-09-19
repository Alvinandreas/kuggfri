/**
 * Planeraren: jämför filer, senast synkat läge och databasen, och räknar ut exakt vad som
 * ska skrivas. Ren modul utan sidoeffekter (docs/INNEHALL.md avsnitt 6).
 *
 * Grundregeln: admin-gränssnittet är redaktörernas domän. Har en rads *innehåll* ändrats där
 * sedan senaste synk rör pipelinen den inte, utan ber om `pull` först. Filerna vinner bara över
 * ändringar i admin när --tvinga anges.
 *
 * Ordningen är undantaget: den följer alltid filerna, eftersom den inte bär någon information som
 * kan gå förlorad och eftersom en radering i admin annars skulle få alla följande kort att se
 * ändrade ut. En omordning gjord i admin kommer in i filerna med `pull`.
 */
import {
  cardContentHash,
  cardId,
  categoryHash,
  categoryId,
  deckHashOf,
  deckId as deckIdFor,
  flattenCards,
  matchKey,
  storedContentHash,
  type ContentCard,
  type ContentCourse,
} from "./model";

// ---------------------------------------------------------------------------
// Databasens läge (svaret från deck_snapshot)
// ---------------------------------------------------------------------------

export type SnapshotDeck = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  course_code: string | null;
  source_credit: string | null;
  exam_date: string | null;
  is_published: boolean;
  sort_order: number;
  source_hash: string | null;
};

export type SnapshotCategory = { id: string; key: string | null; title: string; sort_order: number; source_hash: string | null };

export type SnapshotCard = {
  id: string;
  key: string | null;
  category_id: string | null;
  front: string;
  back: string;
  hint: string | null;
  sort_order: number;
  is_active: boolean;
  source_hash: string | null;
};

export type DeckSnapshot = {
  deck: SnapshotDeck | null;
  categories: SnapshotCategory[];
  cards: SnapshotCard[];
  /** card_id -> antal studenter med progress på kortet. */
  progress: Record<string, number>;
};

export const EMPTY_SNAPSHOT: DeckSnapshot = { deck: null, categories: [], cards: [], progress: {} };

// ---------------------------------------------------------------------------
// Planen
// ---------------------------------------------------------------------------

export type ChangeKind =
  | "deck-create"
  | "deck-update"
  | "category-create"
  | "category-update"
  | "category-delete"
  | "card-create"
  | "card-update"
  | "card-move"
  | "card-sync"
  | "card-adopt"
  | "card-deactivate"
  | "card-delete";

export type PlanChange = { kind: ChangeKind; key: string; label: string; detail?: string; progress?: number };

export type PlanConflict = { key: string; label: string; reason: string };

export type SyncPayload = {
  deck?: {
    slug: string;
    title: string;
    description: string | null;
    course_code: string | null;
    source_credit: string | null;
    exam_date: string | null;
    is_published: boolean;
    sort_order: number;
    source_hash: string;
  };
  categories: {
    create: { id: string; key: string; title: string; sort_order: number; source_hash: string }[];
    update: { id: string; key: string; title: string; sort_order: number; source_hash: string }[];
    delete: string[];
  };
  cards: {
    create: {
      id: string;
      key: string;
      category_id: string | null;
      front: string;
      back: string;
      hint: string | null;
      sort_order: number;
      is_active: boolean;
      source_hash: string;
    }[];
    update: {
      id: string;
      key: string;
      category_id: string | null;
      front: string;
      back: string;
      hint: string | null;
      sort_order: number;
      is_active: boolean;
      source_hash: string;
    }[];
    deactivate: string[];
    delete: string[];
  };
};

export type ContentPlan = {
  courseKey: string;
  deckId: string;
  changes: PlanChange[];
  /** Ändrat både i fil och i admin: apply stoppar om inte force är satt. */
  conflicts: PlanConflict[];
  warnings: string[];
  sync: SyncPayload;
  /** True när ingenting behöver skrivas. */
  empty: boolean;
};

export type PlanOptions = {
  /** Kort som saknas i filerna raderas i stället för att inaktiveras. */
  deleteMissing?: boolean;
  /** Filerna vinner även över ändringar gjorda i admin. */
  force?: boolean;
};

type Dim = "unchanged" | "file" | "db" | "conflict";

/** Trevägsjämförelse för en dimension (innehåll eller placering). */
function compareDim(file: string, db: string, stored: string | null): Dim {
  if (stored === null) return file === db ? "unchanged" : "file"; // adoption: filen vinner första gången
  const fileChanged = file !== stored;
  const dbChanged = db !== stored;
  if (!fileChanged && !dbChanged) return "unchanged";
  if (fileChanged && !dbChanged) return "file";
  if (!fileChanged && dbChanged) return "db";
  return file === db ? "unchanged" : "conflict";
}

function firstLine(text: string): string {
  return (text.split("\n").find((l) => l.trim()) ?? text).trim().slice(0, 70);
}

export function planSync(course: ContentCourse, snapshot: DeckSnapshot, options: PlanOptions = {}): ContentPlan {
  const force = options.force ?? false;
  const changes: PlanChange[] = [];
  const conflicts: PlanConflict[] = [];
  const warnings: string[] = [];
  const sync: SyncPayload = {
    categories: { create: [], update: [], delete: [] },
    cards: { create: [], update: [], deactivate: [], delete: [] },
  };

  const id = snapshot.deck?.id ?? deckIdFor(course.key);

  // -------------------------------------------------------------------------
  // Deck
  // -------------------------------------------------------------------------
  const fileDeckHash = deckHashOf(course);
  const deckValues = {
    slug: course.key,
    title: course.title,
    description: course.description,
    course_code: course.course_code,
    source_credit: course.source_credit,
    exam_date: course.exam_date,
    is_published: course.published,
    sort_order: course.sort_order,
    source_hash: fileDeckHash,
  };
  if (!snapshot.deck) {
    sync.deck = deckValues;
    changes.push({ kind: "deck-create", key: course.key, label: course.title });
  } else {
    const db = snapshot.deck;
    const dbDeckHash = deckHashOf({
      key: db.slug,
      title: db.title,
      description: db.description,
      course_code: db.course_code,
      source_credit: db.source_credit,
      exam_date: db.exam_date,
      published: db.is_published,
      sort_order: db.sort_order,
    });
    const cmp = compareDim(fileDeckHash, dbDeckHash, db.source_hash);
    if (cmp === "file" || (cmp !== "unchanged" && force)) {
      sync.deck = deckValues;
      changes.push({ kind: "deck-update", key: course.key, label: course.title });
    } else if (cmp === "db") {
      warnings.push(`Kursens uppgifter är ändrade i admin sedan senaste synk. Kör pull för att ta in dem i kurs.json.`);
    } else if (cmp === "conflict") {
      conflicts.push({ key: course.key, label: course.title, reason: "kursens uppgifter är ändrade både i filen och i admin" });
    }
  }

  // -------------------------------------------------------------------------
  // Kategorier
  // -------------------------------------------------------------------------
  const dbCategoriesByKey = new Map<string, SnapshotCategory>();
  const unkeyedCategoriesByTitle = new Map<string, SnapshotCategory>();
  for (const c of snapshot.categories) {
    if (c.key) dbCategoriesByKey.set(c.key, c);
    else if (!unkeyedCategoriesByTitle.has(matchKey(c.title))) unkeyedCategoriesByTitle.set(matchKey(c.title), c);
  }

  /** Kategorins nyckel efter synk, per databas-id. Används för kortens placeringshash. */
  const categoryKeyById = new Map<string, string>();
  for (const c of snapshot.categories) categoryKeyById.set(c.id, c.key ?? `id:${c.id}`);
  const categoryIdByKey = new Map<string, string>();
  const matchedCategoryIds = new Set<string>();

  course.categories.forEach((category, index) => {
    const fileHash = categoryHash(category.title);
    let db = dbCategoriesByKey.get(category.key);
    let adopting = false;
    if (!db) {
      const legacy = unkeyedCategoriesByTitle.get(matchKey(category.title));
      if (legacy && !matchedCategoryIds.has(legacy.id)) {
        db = legacy;
        adopting = true;
      }
    }
    const cid = db?.id ?? categoryId(course.key, category.key);
    categoryIdByKey.set(category.key, cid);
    if (db) {
      matchedCategoryIds.add(db.id);
      categoryKeyById.set(db.id, category.key);
    }

    const values = { id: cid, key: category.key, title: category.title, sort_order: index, source_hash: fileHash };
    if (!db) {
      sync.categories.create.push(values);
      changes.push({ kind: "category-create", key: category.key, label: category.title });
      return;
    }
    const dbHash = categoryHash(db.title);
    const cmp = compareDim(fileHash, dbHash, db.source_hash);
    const orderChanged = db.sort_order !== index;
    if (adopting || db.key !== category.key || orderChanged || cmp === "file" || (cmp !== "unchanged" && force)) {
      sync.categories.update.push(values);
      changes.push({
        kind: "category-update",
        key: category.key,
        label: category.title,
        detail: adopting ? "knyter ihop med befintlig kategori" : undefined,
      });
    } else if (cmp === "db") {
      warnings.push(`Kategorin ”${db.title}” har bytt namn i admin. Kör pull.`);
    } else if (cmp === "conflict") {
      conflicts.push({ key: category.key, label: category.title, reason: "ändrad både i filen och i admin" });
    }
  });

  // -------------------------------------------------------------------------
  // Kort
  // -------------------------------------------------------------------------
  const dbCardsByKey = new Map<string, SnapshotCard>();
  const unkeyedCards: SnapshotCard[] = [];
  for (const c of snapshot.cards) {
    if (c.key) dbCardsByKey.set(c.key, c);
    else unkeyedCards.push(c);
  }
  /** Kort utan nyckel, sökbara på kategori + framsida (engångsmatchning vid adoption). */
  const unkeyedByPlace = new Map<string, SnapshotCard[]>();
  for (const c of unkeyedCards) {
    const k = `${c.category_id ?? ""}|${matchKey(c.front)}`;
    unkeyedByPlace.set(k, [...(unkeyedByPlace.get(k) ?? []), c]);
  }

  const usedDbCardIds = new Set<string>();
  const adoptedUnkeyed = new Set<string>();

  for (const { card, categoryKey, sortOrder } of flattenCards(course)) {
    const cKey = card.key;
    const fileContent = cardContentHash(card, categoryKey);
    const targetCategoryId = categoryIdByKey.get(categoryKey) ?? null;

    let db = dbCardsByKey.get(cKey);
    let adopting = false;
    if (!db) {
      const bucket = unkeyedByPlace.get(`${targetCategoryId ?? ""}|${matchKey(card.front)}`) ?? [];
      const candidate = bucket.find((c) => !adoptedUnkeyed.has(c.id));
      if (candidate) {
        db = candidate;
        adopting = true;
        adoptedUnkeyed.add(candidate.id);
      }
    }

    const values = {
      id: db?.id ?? cardId(course.key, cKey),
      key: cKey,
      category_id: targetCategoryId,
      front: card.front,
      back: card.back,
      hint: card.hint,
      sort_order: sortOrder,
      is_active: card.active,
      source_hash: fileContent,
    };

    if (!db) {
      sync.cards.create.push(values);
      changes.push({ kind: "card-create", key: cKey, label: firstLine(card.front) });
      continue;
    }
    usedDbCardIds.add(db.id);

    const dbContent = cardContentHash(
      { front: db.front, back: db.back, hint: db.hint, active: db.is_active },
      categoryKeyById.get(db.category_id ?? "") ?? null,
    );
    const cContent = compareDim(fileContent, dbContent, storedContentHash(db.source_hash));

    if (cContent === "conflict" && !force) {
      conflicts.push({ key: cKey, label: firstLine(card.front), reason: "ändrat både i filen och i admin" });
      continue;
    }
    if (cContent === "db" && !force) {
      warnings.push(`Kortet ”${firstLine(card.front)}” är ändrat i admin. Kör pull för att ta in ändringen i filen.`);
      continue;
    }

    const orderChanged = db.sort_order !== sortOrder;
    const needsWrite = db.key !== cKey || db.source_hash !== values.source_hash || dbContent !== fileContent || orderChanged;
    if (!needsWrite) continue;

    sync.cards.update.push(values);
    if (adopting || db.key !== cKey) {
      changes.push({ kind: "card-adopt", key: cKey, label: firstLine(card.front), detail: "knyter ihop med befintligt kort" });
    } else if (cContent !== "unchanged") {
      changes.push({
        kind: "card-update",
        key: cKey,
        label: firstLine(card.front),
        detail: card.active ? undefined : "inaktiveras",
        progress: snapshot.progress[db.id],
      });
    } else if (orderChanged) {
      changes.push({ kind: "card-move", key: cKey, label: firstLine(card.front) });
    } else {
      // Innehållet stämmer redan; bara den lagrade hashen skrivs om (t.ex. direkt efter
      // en pull som tagit in en ändring från admin).
      changes.push({ kind: "card-sync", key: cKey, label: firstLine(card.front) });
    }
  }

  // Kort i databasen som inte finns i filerna
  let adminOnly = 0;
  for (const db of snapshot.cards) {
    if (usedDbCardIds.has(db.id) || adoptedUnkeyed.has(db.id)) continue;
    if (!db.key) {
      // Skapat i admin och ännu inte draget till filerna: rör det aldrig.
      adminOnly++;
      continue;
    }
    const progress = snapshot.progress[db.id];
    if (options.deleteMissing) {
      sync.cards.delete.push(db.id);
      changes.push({ kind: "card-delete", key: db.key, label: firstLine(db.front), progress });
    } else if (db.is_active) {
      sync.cards.deactivate.push(db.id);
      changes.push({ kind: "card-deactivate", key: db.key, label: firstLine(db.front), progress });
    }
  }
  if (adminOnly > 0) {
    warnings.push(
      `${adminOnly === 1 ? "1 kort finns" : `${adminOnly} kort finns`} bara i databasen (skapade i admin). De lämnas orörda; kör pull för att ta in dem i filerna.`,
    );
  }

  // Kategorier i databasen som inte finns i filerna
  const deletedCardIds = new Set(sync.cards.delete);
  for (const db of snapshot.categories) {
    if (matchedCategoryIds.has(db.id)) continue;
    if (!db.key) {
      warnings.push(`Kategorin ”${db.title}” finns bara i databasen (skapad i admin). Kör pull för att ta in den.`);
      continue;
    }
    const remaining = snapshot.cards.filter((c) => c.category_id === db.id && !deletedCardIds.has(c.id) && !usedDbCardIds.has(c.id));
    if (remaining.length > 0) {
      warnings.push(`Kategorin ”${db.title}” saknas i filerna men har kvar ${remaining.length} kort. Den lämnas kvar.`);
      continue;
    }
    sync.categories.delete.push(db.id);
    changes.push({ kind: "category-delete", key: db.key, label: db.title });
  }

  const empty =
    !sync.deck &&
    sync.categories.create.length === 0 &&
    sync.categories.update.length === 0 &&
    sync.categories.delete.length === 0 &&
    sync.cards.create.length === 0 &&
    sync.cards.update.length === 0 &&
    sync.cards.deactivate.length === 0 &&
    sync.cards.delete.length === 0;

  return { courseKey: course.key, deckId: id, changes, conflicts, warnings, sync, empty };
}

// ---------------------------------------------------------------------------
// Pull: databasens läge → filmodell
// ---------------------------------------------------------------------------

/**
 * Bygger en kursmodell ur databasen. Kort och kategorier som saknar nyckel får en härledd
 * nyckel (unik inom kursen). Befintliga nycklar och filnamn från `current` behålls.
 */
export function courseFromSnapshot(
  snapshot: DeckSnapshot,
  current: ContentCourse | null,
  deriveKey: (text: string, taken: Set<string>) => string,
): ContentCourse {
  if (!snapshot.deck) throw new Error("Decket finns inte i databasen.");
  const deck = snapshot.deck;
  const takenCategoryKeys = new Set<string>();
  const takenCardKeys = new Set<string>();
  for (const c of snapshot.categories) if (c.key) takenCategoryKeys.add(c.key);
  for (const c of snapshot.cards) if (c.key) takenCardKeys.add(c.key);

  const fileByCategoryKey = new Map<string, string>();
  for (const c of current?.categories ?? []) fileByCategoryKey.set(c.key, c.file);

  const categories = [...snapshot.categories]
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, "sv"))
    .map((c, index) => {
      const key = c.key ?? deriveKey(c.title, takenCategoryKeys);
      const cards: ContentCard[] = [...snapshot.cards]
        .filter((card) => card.category_id === c.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((card) => ({
          key: card.key ?? deriveKey(card.front, takenCardKeys),
          front: card.front,
          back: card.back,
          hint: card.hint,
          active: card.is_active,
        }));
      return {
        key,
        title: c.title,
        file: fileByCategoryKey.get(key) ?? `${String(index + 1).padStart(2, "0")}-${key}.md`,
        cards,
      };
    });

  // Kort utan kategori hamnar sist i en egen fil, så att de inte tappas bort vid pull.
  const uncategorized = [...snapshot.cards]
    .filter((card) => card.category_id === null)
    .sort((a, b) => a.sort_order - b.sort_order);
  if (uncategorized.length > 0) {
    categories.push({
      key: "utan-kategori",
      title: "Utan kategori",
      file: fileByCategoryKey.get("utan-kategori") ?? `${String(categories.length + 1).padStart(2, "0")}-utan-kategori.md`,
      cards: uncategorized.map((card) => ({
        key: card.key ?? deriveKey(card.front, takenCardKeys),
        front: card.front,
        back: card.back,
        hint: card.hint,
        active: card.is_active,
      })),
    });
  }

  return {
    key: deck.slug,
    title: deck.title,
    description: deck.description,
    course_code: deck.course_code,
    source_credit: deck.source_credit,
    exam_date: deck.exam_date,
    published: deck.is_published,
    sort_order: deck.sort_order,
    categories,
  };
}
