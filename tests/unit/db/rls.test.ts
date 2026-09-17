/**
 * RLS-tester: ett test per policy som verifierar att otillåten åtkomst nekas
 * och att tillåten åtkomst fungerar. Körs mot riktig Postgres (PGlite) med
 * samma migrationsfiler som produktionen.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, as, createTestDb, createUser, expectDenied, user, type RawDb } from "./harness";

let db: RawDb;
let alice: string; // vanlig användare
let bob: string; // vanlig användare
let admin: string; // admin
let publishedDeck: string;
let draftDeck: string;
let publishedCategory: string;
let draftCategory: string;
let publishedCard: string;
let draftCard: string;

beforeAll(async () => {
  db = await createTestDb();
  alice = await createUser(db, "alice@example.com", { displayName: "Alice" });
  bob = await createUser(db, "bob@example.com");
  admin = await createUser(db, "admin@example.com", { admin: true });

  const decks = await db.query<{ id: string; slug: string }>(
    `insert into public.decks (slug, title, is_published) values
       ('publicerat', 'Publicerat deck', true),
       ('utkast', 'Utkast', false)
     returning id, slug`,
  );
  publishedDeck = decks.find((d) => d.slug === "publicerat")!.id;
  draftDeck = decks.find((d) => d.slug === "utkast")!.id;

  const cats = await db.query<{ id: string; deck_id: string }>(
    `insert into public.categories (deck_id, title) values ($1, 'Kat A'), ($2, 'Kat B') returning id, deck_id`,
    [publishedDeck, draftDeck],
  );
  publishedCategory = cats.find((c) => c.deck_id === publishedDeck)!.id;
  draftCategory = cats.find((c) => c.deck_id === draftDeck)!.id;

  const cards = await db.query<{ id: string; deck_id: string }>(
    `insert into public.cards (deck_id, category_id, front, back) values
       ($1, $3, 'Fråga 1', 'Svar 1'),
       ($2, $4, 'Hemlig fråga', 'Hemligt svar')
     returning id, deck_id`,
    [publishedDeck, draftDeck, publishedCategory, draftCategory],
  );
  publishedCard = cards.find((c) => c.deck_id === publishedDeck)!.id;
  draftCard = cards.find((c) => c.deck_id === draftDeck)!.id;

  await db.query(
    `insert into public.card_progress (user_id, card_id, self_rating, reps) values ($1, $3, 2, 1), ($2, $3, 5, 3)`,
    [alice, bob, publishedCard],
  );
  await db.query(
    `insert into public.study_sessions (user_id, deck_id, mode, cards_reviewed) values ($1, $3, 'fsrs', 5), ($2, $3, 'free', 2)`,
    [alice, bob, publishedDeck],
  );
});

afterAll(async () => {
  await db?.close();
});

describe("decks", () => {
  it("anon läser bara publicerade deck", async () => {
    const rows = await anon(db).query<{ slug: string }>("select slug from public.decks order by slug");
    expect(rows.map((r) => r.slug)).toEqual(["publicerat"]);
  });

  it("vanlig användare läser bara publicerade deck", async () => {
    const rows = await user(db, alice).query<{ slug: string }>("select slug from public.decks order by slug");
    expect(rows.map((r) => r.slug)).toEqual(["publicerat"]);
  });

  it("admin läser alla deck", async () => {
    const rows = await user(db, admin).query<{ slug: string }>("select slug from public.decks order by slug");
    expect(rows.map((r) => r.slug)).toEqual(["publicerat", "utkast"]);
  });

  it("anon kan inte skapa deck", async () => {
    await expectDenied(anon(db).query(`insert into public.decks (slug, title) values ('anon-deck', 'x')`));
  });

  it("vanlig användare kan inte skapa deck", async () => {
    await expectDenied(user(db, alice).query(`insert into public.decks (slug, title) values ('alice-deck', 'x')`));
  });

  it("vanlig användare kan inte uppdatera deck (0 rader påverkas)", async () => {
    const rows = await user(db, alice).query(`update public.decks set title = 'Hackat' where id = $1 returning id`, [publishedDeck]);
    expect(rows).toHaveLength(0);
    const [deck] = await db.query<{ title: string }>(`select title from public.decks where id = $1`, [publishedDeck]);
    expect(deck?.title).toBe("Publicerat deck");
  });

  it("vanlig användare kan inte ta bort deck", async () => {
    const rows = await user(db, alice).query(`delete from public.decks where id = $1 returning id`, [publishedDeck]);
    expect(rows).toHaveLength(0);
  });

  it("admin kan skapa, uppdatera och ta bort deck", async () => {
    const [created] = await user(db, admin).query<{ id: string }>(
      `insert into public.decks (slug, title) values ('admin-deck', 'Admin') returning id`,
    );
    expect(created?.id).toBeTruthy();
    const updated = await user(db, admin).query(`update public.decks set title = 'Ändrad' where id = $1 returning id`, [created!.id]);
    expect(updated).toHaveLength(1);
    const deleted = await user(db, admin).query(`delete from public.decks where id = $1 returning id`, [created!.id]);
    expect(deleted).toHaveLength(1);
  });
});

describe("categories", () => {
  it("anon ser bara kategorier i publicerade deck", async () => {
    const rows = await anon(db).query<{ title: string }>("select title from public.categories order by title");
    expect(rows.map((r) => r.title)).toEqual(["Kat A"]);
  });

  it("vanlig användare ser inte kategorier i opublicerade deck", async () => {
    const rows = await user(db, bob).query(`select id from public.categories where id = $1`, [draftCategory]);
    expect(rows).toHaveLength(0);
  });

  it("admin ser alla kategorier", async () => {
    const rows = await user(db, admin).query("select id from public.categories");
    expect(rows).toHaveLength(2);
  });

  it("vanlig användare kan inte skapa kategori", async () => {
    await expectDenied(user(db, alice).query(`insert into public.categories (deck_id, title) values ($1, 'Ny')`, [publishedDeck]));
  });

  it("vanlig användare kan inte uppdatera eller ta bort kategori", async () => {
    const updated = await user(db, alice).query(`update public.categories set title = 'x' where id = $1 returning id`, [publishedCategory]);
    expect(updated).toHaveLength(0);
    const deleted = await user(db, alice).query(`delete from public.categories where id = $1 returning id`, [publishedCategory]);
    expect(deleted).toHaveLength(0);
  });

  it("admin kan skriva kategorier", async () => {
    const rows = await user(db, admin).query<{ id: string }>(
      `insert into public.categories (deck_id, title) values ($1, 'Adminkat') returning id`,
      [draftDeck],
    );
    expect(rows).toHaveLength(1);
    await user(db, admin).query(`delete from public.categories where id = $1`, [rows[0]!.id]);
  });
});

describe("cards", () => {
  it("anon ser bara kort i publicerade deck", async () => {
    const rows = await anon(db).query<{ front: string }>("select front from public.cards order by front");
    expect(rows.map((r) => r.front)).toEqual(["Fråga 1"]);
  });

  it("vanlig användare ser inte kort i opublicerade deck", async () => {
    const rows = await user(db, alice).query(`select id from public.cards where id = $1`, [draftCard]);
    expect(rows).toHaveLength(0);
  });

  it("admin ser alla kort", async () => {
    const rows = await user(db, admin).query("select id from public.cards");
    expect(rows).toHaveLength(2);
  });

  it("anon kan inte skapa kort", async () => {
    await expectDenied(anon(db).query(`insert into public.cards (deck_id, front, back) values ($1, 'a', 'b')`, [publishedDeck]));
  });

  it("vanlig användare kan inte skapa kort", async () => {
    await expectDenied(user(db, alice).query(`insert into public.cards (deck_id, front, back) values ($1, 'a', 'b')`, [publishedDeck]));
  });

  it("vanlig användare kan inte uppdatera eller ta bort kort", async () => {
    const updated = await user(db, alice).query(`update public.cards set back = 'x' where id = $1 returning id`, [publishedCard]);
    expect(updated).toHaveLength(0);
    const deleted = await user(db, alice).query(`delete from public.cards where id = $1 returning id`, [publishedCard]);
    expect(deleted).toHaveLength(0);
    const [card] = await db.query<{ back: string }>(`select back from public.cards where id = $1`, [publishedCard]);
    expect(card?.back).toBe("Svar 1");
  });

  it("admin kan skapa, uppdatera och ta bort kort", async () => {
    const [created] = await user(db, admin).query<{ id: string }>(
      `insert into public.cards (deck_id, front, back) values ($1, 'Adminfråga', 'Adminsvar') returning id`,
      [publishedDeck],
    );
    const updated = await user(db, admin).query(`update public.cards set back = 'Nytt' where id = $1 returning id`, [created!.id]);
    expect(updated).toHaveLength(1);
    const deleted = await user(db, admin).query(`delete from public.cards where id = $1 returning id`, [created!.id]);
    expect(deleted).toHaveLength(1);
  });
});

describe("profiles", () => {
  it("anon kan inte läsa profiler", async () => {
    await expectDenied(anon(db).query("select * from public.profiles"));
  });

  it("användare läser bara sin egen profil", async () => {
    const rows = await user(db, alice).query<{ id: string }>("select id from public.profiles");
    expect(rows.map((r) => r.id)).toEqual([alice]);
  });

  it("användare kan uppdatera sitt visningsnamn", async () => {
    const rows = await user(db, alice).query(`update public.profiles set display_name = 'Alice B' where id = $1 returning id`, [alice]);
    expect(rows).toHaveLength(1);
  });

  it("användare kan inte uppdatera någon annans profil", async () => {
    const rows = await user(db, alice).query(`update public.profiles set display_name = 'Hackad' where id = $1 returning id`, [bob]);
    expect(rows).toHaveLength(0);
  });

  it("användare kan inte göra sig själv till admin", async () => {
    await expectDenied(user(db, alice).query(`update public.profiles set is_admin = true where id = $1`, [alice]));
    const [row] = await db.query<{ is_admin: boolean }>(`select is_admin from public.profiles where id = $1`, [alice]);
    expect(row?.is_admin).toBe(false);
  });

  it("användare kan inte skapa eller ta bort profiler", async () => {
    await expectDenied(
      user(db, alice).query(`insert into public.profiles (id) values ('00000000-0000-4000-8000-000000000001')`),
      /permission denied/i,
    );
    await expectDenied(user(db, alice).query(`delete from public.profiles where id = $1`, [alice]), /permission denied/i);
    expect(await db.query(`select 1 from public.profiles where id = $1`, [alice])).toHaveLength(1);
  });
});

describe("card_progress", () => {
  it("anon nekas helt", async () => {
    await expectDenied(anon(db).query("select * from public.card_progress"));
    await expectDenied(anon(db).query(`insert into public.card_progress (user_id, card_id) values ($1, $2)`, [alice, publishedCard]));
  });

  it("användare läser bara sina egna rader", async () => {
    const rows = await user(db, alice).query<{ user_id: string; self_rating: number }>("select user_id, self_rating from public.card_progress");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.user_id).toBe(alice);
    expect(rows[0]?.self_rating).toBe(2);
  });

  it("användare kan inte skapa rader åt någon annan", async () => {
    await expectDenied(
      user(db, alice).query(`insert into public.card_progress (user_id, card_id, self_rating) values ($1, $2, 1)`, [bob, draftCard]),
    );
  });

  it("användare kan inte uppdatera någon annans rad", async () => {
    const rows = await user(db, alice).query(
      `update public.card_progress set self_rating = 1 where user_id = $1 and card_id = $2 returning card_id`,
      [bob, publishedCard],
    );
    expect(rows).toHaveLength(0);
    const [bobRow] = await db.query<{ self_rating: number }>(`select self_rating from public.card_progress where user_id = $1`, [bob]);
    expect(bobRow?.self_rating).toBe(5);
  });

  it("användare kan inte flytta en rad till någon annan", async () => {
    await expectDenied(
      user(db, alice).query(`update public.card_progress set user_id = $1 where user_id = $2`, [bob, alice]),
    );
  });

  it("användare kan inte ta bort någon annans rad", async () => {
    const rows = await user(db, alice).query(`delete from public.card_progress where user_id = $1 returning card_id`, [bob]);
    expect(rows).toHaveLength(0);
    const bobRows = await db.query(`select 1 from public.card_progress where user_id = $1`, [bob]);
    expect(bobRows).toHaveLength(1);
  });

  it("användare kan skapa, uppdatera och ta bort egna rader (upsert)", async () => {
    const [created] = await user(db, bob).query<{ card_id: string }>(
      `insert into public.card_progress (user_id, card_id, self_rating) values ($1, $2, 3)
       on conflict (user_id, card_id) do update set self_rating = excluded.self_rating returning card_id`,
      [bob, publishedCard],
    );
    expect(created?.card_id).toBe(publishedCard);
    const deleted = await user(db, bob).query(`delete from public.card_progress where user_id = $1 and card_id = $2 returning card_id`, [bob, publishedCard]);
    expect(deleted).toHaveLength(1);
    // Återställ Bobs rad för övriga tester.
    await db.query(`insert into public.card_progress (user_id, card_id, self_rating, reps) values ($1, $2, 5, 3)`, [bob, publishedCard]);
  });
});

describe("study_sessions", () => {
  it("anon nekas helt", async () => {
    await expectDenied(anon(db).query("select * from public.study_sessions"));
    await expectDenied(anon(db).query(`insert into public.study_sessions (deck_id, mode) values ($1, 'free')`, [publishedDeck]));
  });

  it("användare läser bara sina egna sessioner", async () => {
    const rows = await user(db, alice).query<{ user_id: string }>("select user_id from public.study_sessions");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.user_id).toBe(alice);
  });

  it("användare kan inte skapa sessioner åt någon annan eller utan user_id", async () => {
    await expectDenied(user(db, alice).query(`insert into public.study_sessions (user_id, deck_id, mode) values ($1, $2, 'free')`, [bob, publishedDeck]));
    await expectDenied(user(db, alice).query(`insert into public.study_sessions (user_id, deck_id, mode) values (null, $1, 'free')`, [publishedDeck]));
  });

  it("användare kan inte uppdatera eller ta bort någon annans session", async () => {
    const updated = await user(db, alice).query(`update public.study_sessions set cards_reviewed = 99 where user_id = $1 returning id`, [bob]);
    expect(updated).toHaveLength(0);
    const deleted = await user(db, alice).query(`delete from public.study_sessions where user_id = $1 returning id`, [bob]);
    expect(deleted).toHaveLength(0);
  });

  it("användare kan skapa och uppdatera egna sessioner", async () => {
    const [created] = await user(db, alice).query<{ id: string }>(
      `insert into public.study_sessions (user_id, deck_id, mode) values ($1, $2, 'random') returning id`,
      [alice, publishedDeck],
    );
    const updated = await user(db, alice).query(`update public.study_sessions set ended_at = now(), cards_reviewed = 3 where id = $1 returning id`, [created!.id]);
    expect(updated).toHaveLength(1);
  });

  it("ogiltigt läge avvisas", async () => {
    await expectDenied(
      user(db, alice).query(`insert into public.study_sessions (user_id, deck_id, mode) values ($1, $2, 'cheat')`, [alice, publishedDeck]),
      /check constraint|violates/i,
    );
  });
});

describe("review_log", () => {
  it("anon nekas helt", async () => {
    await expectDenied(anon(db).query("select * from public.review_log"));
    await expectDenied(anon(db).query(`insert into public.review_log (user_id, card_id, rating, mode) values ($1, $2, 3, 'fsrs')`, [alice, publishedCard]));
  });

  it("användare kan logga och läsa bara egna rader", async () => {
    await user(db, alice).query(`insert into public.review_log (user_id, card_id, rating, mode) values ($1, $2, 4, 'fsrs')`, [alice, publishedCard]);
    await user(db, bob).query(`insert into public.review_log (user_id, card_id, rating, mode) values ($1, $2, 1, 'tricky')`, [bob, publishedCard]);
    const mine = await user(db, alice).query<{ user_id: string; rating: number }>("select user_id, rating from public.review_log");
    expect(mine).toHaveLength(1);
    expect(mine[0]?.user_id).toBe(alice);
  });

  it("användare kan inte logga åt någon annan, uppdatera eller ta bort", async () => {
    await expectDenied(user(db, alice).query(`insert into public.review_log (user_id, card_id, rating, mode) values ($1, $2, 5, 'fsrs')`, [bob, publishedCard]));
    await expectDenied(user(db, alice).query(`update public.review_log set rating = 5 where user_id = $1`, [alice]), /permission denied/i);
    await expectDenied(user(db, alice).query(`delete from public.review_log where user_id = $1`, [alice]), /permission denied/i);
  });

  it("ogiltig skattning eller läge avvisas", async () => {
    await expectDenied(user(db, alice).query(`insert into public.review_log (user_id, card_id, rating, mode) values ($1, $2, 6, 'fsrs')`, [alice, publishedCard]), /check|violates/i);
    await expectDenied(user(db, alice).query(`insert into public.review_log (user_id, card_id, rating, mode) values ($1, $2, 3, 'cheat')`, [alice, publishedCard]), /check|violates/i);
  });

  it("nollställning av deck tar bort egen historik för decket, inte andras", async () => {
    const [r] = await user(db, alice).query<{ n: number }>(`select public.reset_deck_progress($1) as n`, [publishedDeck]);
    expect(typeof r?.n).toBe("number");
    expect(await db.query(`select 1 from public.review_log where user_id = $1`, [alice])).toHaveLength(0);
    expect(await db.query(`select 1 from public.review_log where user_id = $1`, [bob])).toHaveLength(1);
    // Återställ Alices progressrad som nollställningen tog bort; senare tester räknar med den.
    await db.query(`insert into public.card_progress (user_id, card_id, self_rating, reps) values ($1, $2, 2, 1)`, [alice, publishedCard]);
  });
});

describe("card_reports", () => {
  it("gäst (anon) kan rapportera kort i publicerat deck, men inte i utkast", async () => {
    await anon(db).query(`insert into public.card_reports (card_id, message) values ($1, 'Fel enhet i svaret')`, [publishedCard]);
    await expectDenied(anon(db).query(`insert into public.card_reports (card_id, message) values ($1, 'Smyg')`, [draftCard]));
  });

  it("gäst kan inte sätta user_id eller status, och inte läsa", async () => {
    await expectDenied(anon(db).query(`insert into public.card_reports (card_id, message, user_id) values ($1, 'x y z', $2)`, [publishedCard, alice]), /permission denied/i);
    await expectDenied(anon(db).query(`insert into public.card_reports (card_id, message, status) values ($1, 'x y z', 'resolved')`, [publishedCard]), /permission denied/i);
    await expectDenied(anon(db).query("select * from public.card_reports"), /permission denied/i);
  });

  it("inloggad användare rapporterar med sitt user_id automatiskt, men ser ingenting", async () => {
    await user(db, alice).query(`insert into public.card_reports (card_id, message, contact) values ($1, 'Otydlig fråga', 'alice@example.com')`, [publishedCard]);
    const rows = await db.query<{ user_id: string | null }>(`select user_id from public.card_reports where message = 'Otydlig fråga'`);
    expect(rows[0]?.user_id).toBe(alice);
    expect(await user(db, alice).query("select * from public.card_reports")).toHaveLength(0);
    // Kolumnrättighet finns, men RLS döljer alla rader: uppdateringen träffar 0 rader.
    await user(db, alice).query(`update public.card_reports set status = 'resolved'`);
    expect(await db.query(`select 1 from public.card_reports where status = 'resolved'`)).toHaveLength(0);
  });

  it("för kort meddelande avvisas", async () => {
    await expectDenied(anon(db).query(`insert into public.card_reports (card_id, message) values ($1, '  ')`, [publishedCard]), /check|violates/i);
  });

  it("admin läser, åtgärdar och tar bort", async () => {
    const all = await user(db, admin).query<{ id: string; status: string }>("select id, status from public.card_reports order by created_at");
    expect(all.length).toBeGreaterThanOrEqual(2);
    await user(db, admin).query(`update public.card_reports set status = 'resolved', resolved_at = now() where id = $1`, [all[0]!.id]);
    const after = await user(db, admin).query<{ status: string }>("select status from public.card_reports where id = $1", [all[0]!.id]);
    expect(after[0]?.status).toBe("resolved");
    await user(db, admin).query("delete from public.card_reports where id = $1", [all[0]!.id]);
    expect(await user(db, admin).query("select 1 from public.card_reports where id = $1", [all[0]!.id])).toHaveLength(0);
  });

  it("vanlig användare kan inte uppdatera eller ta bort rapporter (0 rader)", async () => {
    const before = await db.query("select 1 from public.card_reports");
    // Kolumnrättighet finns (update/delete), men RLS filtrerar bort alla rader: 0 påverkade.
    await user(db, bob).query("delete from public.card_reports");
    expect(await db.query("select 1 from public.card_reports")).toHaveLength(before.length);
  });
});

describe("funktioner", () => {
  it("is_admin() svarar rätt per identitet", async () => {
    expect((await anon(db).query<{ is_admin: boolean }>("select public.is_admin() as is_admin"))[0]?.is_admin).toBe(false);
    expect((await user(db, alice).query<{ is_admin: boolean }>("select public.is_admin() as is_admin"))[0]?.is_admin).toBe(false);
    expect((await user(db, admin).query<{ is_admin: boolean }>("select public.is_admin() as is_admin"))[0]?.is_admin).toBe(true);
  });

  it("anon kan inte anropa nollställnings- eller raderingsfunktioner", async () => {
    await expectDenied(anon(db).query(`select public.reset_deck_progress($1)`, [publishedDeck]));
    await expectDenied(anon(db).query(`select public.reset_all_progress()`));
    await expectDenied(anon(db).query(`select public.reset_schedule_keep_ratings(null)`));
    await expectDenied(anon(db).query(`select public.delete_my_account()`));
  });

  it("reset_deck_progress nollställer bara den egna progressen", async () => {
    await db.query(`insert into public.card_progress (user_id, card_id, self_rating, reps) values ($1, $2, 4, 2)`, [alice, draftCard]);
    const [r] = await user(db, alice).query<{ n: number }>(`select public.reset_deck_progress($1) as n`, [publishedDeck]);
    expect(r?.n).toBe(1);
    const aliceRows = await db.query<{ card_id: string }>(`select card_id from public.card_progress where user_id = $1`, [alice]);
    expect(aliceRows.map((x) => x.card_id)).toEqual([draftCard]);
    const bobRows = await db.query(`select 1 from public.card_progress where user_id = $1`, [bob]);
    expect(bobRows).toHaveLength(1);
  });

  it("reset_schedule_keep_ratings behåller self_rating", async () => {
    await db.query(
      `update public.card_progress set reps = 7, lapses = 2, state = 2, stability = 12.5, difficulty = 5.1, scheduled_days = 10, elapsed_days = 3, last_review = now(), due = now() + interval '10 days' where user_id = $1 and card_id = $2`,
      [alice, draftCard],
    );
    const [r] = await user(db, alice).query<{ n: number }>(`select public.reset_schedule_keep_ratings(null) as n`);
    expect(r?.n).toBe(1);
    const [row] = await db.query<{ self_rating: number; reps: number; state: number; stability: number; last_review: string | null }>(
      `select self_rating, reps, state, stability, last_review from public.card_progress where user_id = $1 and card_id = $2`,
      [alice, draftCard],
    );
    expect(row?.self_rating).toBe(4);
    expect(row?.reps).toBe(0);
    expect(row?.state).toBe(0);
    expect(row?.stability).toBe(0);
    expect(row?.last_review).toBeNull();
    // Bobs rad orörd
    const [bobRow] = await db.query<{ reps: number }>(`select reps from public.card_progress where user_id = $1`, [bob]);
    expect(bobRow?.reps).toBe(3);
  });

  it("reset_all_progress tar bara bort egna rader", async () => {
    const [r] = await user(db, alice).query<{ n: number }>(`select public.reset_all_progress() as n`);
    expect(r?.n).toBe(1);
    expect(await db.query(`select 1 from public.card_progress where user_id = $1`, [alice])).toHaveLength(0);
    expect(await db.query(`select 1 from public.card_progress where user_id = $1`, [bob])).toHaveLength(1);
  });

  it("statistikfunktionerna nekas för vanlig användare men fungerar för admin", async () => {
    await expectDenied(user(db, alice).query(`select * from public.deck_stats_summary($1)`, [publishedDeck]));
    await expectDenied(user(db, alice).query(`select * from public.deck_stats_cards($1)`, [publishedDeck]));
    const [summary] = await user(db, admin).query<{ unique_users: number; total_reviews: number; avg_rating: number }>(
      `select * from public.deck_stats_summary($1)`,
      [publishedDeck],
    );
    expect(Number(summary?.unique_users)).toBe(1);
    expect(Number(summary?.total_reviews)).toBe(3);
    expect(Number(summary?.avg_rating)).toBe(5);
    const cards = await user(db, admin).query<{ front: string; rating_count: number }>(`select * from public.deck_stats_cards($1)`, [publishedDeck]);
    expect(cards.map((c) => c.front)).toEqual(["Fråga 1"]);
    expect(Number(cards[0]?.rating_count)).toBe(1);
  });

  it("delete_my_account raderar bara det egna kontot och kaskaderar", async () => {
    const victim = await createUser(db, "victim@example.com");
    await db.query(`insert into public.card_progress (user_id, card_id, self_rating) values ($1, $2, 3)`, [victim, publishedCard]);
    await db.query(`insert into public.study_sessions (user_id, deck_id, mode) values ($1, $2, 'fsrs')`, [victim, publishedDeck]);

    await user(db, victim).query(`select public.delete_my_account()`);

    expect(await db.query(`select 1 from auth.users where id = $1`, [victim])).toHaveLength(0);
    expect(await db.query(`select 1 from public.profiles where id = $1`, [victim])).toHaveLength(0);
    expect(await db.query(`select 1 from public.card_progress where user_id = $1`, [victim])).toHaveLength(0);
    expect(await db.query(`select 1 from public.study_sessions where user_id = $1`, [victim])).toHaveLength(0);
    // Andra användare finns kvar.
    expect(await db.query(`select 1 from auth.users where id = $1`, [bob])).toHaveLength(1);
  });

  it("reorder_cards/reorder_categories påverkar inga rader för vanlig användare men fungerar för admin", async () => {
    const created = await db.query<{ id: string }>(
      `insert into public.cards (deck_id, front, back, sort_order) values ($1, 'O1', 'x', 0), ($1, 'O2', 'x', 1), ($1, 'O3', 'x', 2) returning id`,
      [publishedDeck],
    );
    const ids = created.map((c) => c.id);
    const reversed = [...ids].reverse();

    const [asUser] = await user(db, alice).query<{ n: number }>(`select public.reorder_cards($1, $2::uuid[]) as n`, [publishedDeck, reversed]);
    expect(asUser?.n).toBe(0);
    const unchanged = await db.query<{ id: string; sort_order: number }>(`select id, sort_order from public.cards where id = any($1::uuid[]) order by sort_order`, [ids]);
    expect(unchanged.map((c) => c.id)).toEqual(ids);

    const [asAdmin] = await user(db, admin).query<{ n: number }>(`select public.reorder_cards($1, $2::uuid[]) as n`, [publishedDeck, reversed]);
    expect(asAdmin?.n).toBe(3);
    const changed = await db.query<{ id: string }>(`select id from public.cards where id = any($1::uuid[]) order by sort_order`, [ids]);
    expect(changed.map((c) => c.id)).toEqual(reversed);

    await expectDenied(anon(db).query(`select public.reorder_categories($1, $2::uuid[])`, [publishedDeck, [publishedCategory]]));
    const [catUser] = await user(db, alice).query<{ n: number }>(`select public.reorder_categories($1, $2::uuid[]) as n`, [publishedDeck, [publishedCategory]]);
    expect(catUser?.n).toBe(0);
    await db.query(`delete from public.cards where id = any($1::uuid[])`, [ids]);
  });

  it("service_role går förbi RLS (används aldrig i appen, bara som referens)", async () => {
    const rows = await as(db, { role: "service_role" }).query("select id from public.decks");
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});

describe("examinatorer (deck_examiners)", () => {
  let examiner: string;
  let otherDeck: string;
  let otherCard: string;

  beforeAll(async () => {
    examiner = await createUser(db, "examinator@chalmers.se", { displayName: "Johan" });
    const [d] = await db.query<{ id: string }>(`insert into public.decks (slug, title, is_published) values ('annan-kurs', 'Annan kurs', false) returning id`);
    otherDeck = d!.id;
    const [c] = await db.query<{ id: string }>(`insert into public.cards (deck_id, front, back) values ($1, 'Annan fråga', 'Annat svar') returning id`, [otherDeck]);
    otherCard = c!.id;
  });

  it("bara admin kan lägga till och lista examinatorer, och uppslaget sker på e-post", async () => {
    await expectDenied(user(db, alice).query(`select public.add_deck_examiner($1, 'examinator@chalmers.se')`, [draftDeck]));
    await expectDenied(user(db, alice).query(`select * from public.list_deck_examiners($1)`, [draftDeck]));
    const [invited] = await user(db, admin).query<{ r: string }>(`select public.add_deck_examiner($1, ' Kommande@Example.com ') as r`, [draftDeck]);
    expect(invited?.r).toBe("invited");
    const [invitedAgain] = await user(db, admin).query<{ r: string }>(`select public.add_deck_examiner($1, 'kommande@example.com') as r`, [draftDeck]);
    expect(invitedAgain?.r).toBe("exists");
    const pending = await user(db, admin).query<{ email: string; pending: boolean; user_id: string | null }>(`select * from public.list_deck_examiners($1) where pending`, [draftDeck]);
    expect(pending.map((x) => [x.email, x.user_id])).toEqual([["kommande@example.com", null]]);
    await expectDenied(user(db, alice).query(`select * from public.deck_examiner_invites`), /permission denied/i);
    const [added] = await user(db, admin).query<{ r: string }>(`select public.add_deck_examiner($1, ' Examinator@Chalmers.se ') as r`, [draftDeck]);
    expect(added?.r).toBe("added");
    const [again] = await user(db, admin).query<{ r: string }>(`select public.add_deck_examiner($1, 'examinator@chalmers.se') as r`, [draftDeck]);
    expect(again?.r).toBe("exists");
    const list = await user(db, admin).query<{ email: string; display_name: string }>(`select * from public.list_deck_examiners($1) where not pending`, [draftDeck]);
    expect(list.map((x) => x.email)).toEqual(["examinator@chalmers.se"]);
    expect(list[0]?.display_name).toBe("Johan");
    // Examinatorn ser sin egen rad, inte andras; ingen kan skriva direkt i tabellen.
    expect(await user(db, examiner).query(`select deck_id from public.deck_examiners`)).toHaveLength(1);
    expect(await user(db, alice).query(`select deck_id from public.deck_examiners`)).toHaveLength(0);
    await expectDenied(user(db, examiner).query(`insert into public.deck_examiners (deck_id, user_id) values ($1, $2)`, [otherDeck, examiner]), /permission denied/i);
  });

  it("can_edit_deck: sant för admin och för examinatorn på sitt deck, annars falskt", async () => {
    const q = async (who: ReturnType<typeof user>, deck: string) => (await who.query<{ ok: boolean }>(`select public.can_edit_deck($1) as ok`, [deck]))[0]?.ok;
    expect(await q(user(db, examiner), draftDeck)).toBe(true);
    expect(await q(user(db, examiner), otherDeck)).toBe(false);
    expect(await q(user(db, alice), draftDeck)).toBe(false);
    expect(await q(user(db, admin), otherDeck)).toBe(true);
  });

  it("examinatorn ser och redigerar sitt (opublicerade) deck men inte andra deck", async () => {
    expect(await user(db, examiner).query(`select id from public.decks where id = $1`, [draftDeck])).toHaveLength(1);
    expect(await user(db, examiner).query(`select id from public.decks where id = $1`, [otherDeck])).toHaveLength(0);
    expect(await user(db, examiner).query(`select id from public.cards where id = $1`, [draftCard])).toHaveLength(1);
    expect(await user(db, examiner).query(`select id from public.cards where id = $1`, [otherCard])).toHaveLength(0);
    await user(db, examiner).query(`update public.decks set description = 'Ändrad av examinatorn' where id = $1`, [draftDeck]);
    expect((await db.query<{ description: string }>(`select description from public.decks where id = $1`, [draftDeck]))[0]?.description).toBe("Ändrad av examinatorn");
    await user(db, examiner).query(`update public.cards set back = 'Nytt svar' where id = $1`, [draftCard]);
    expect((await db.query<{ back: string }>(`select back from public.cards where id = $1`, [draftCard]))[0]?.back).toBe("Nytt svar");
    await user(db, examiner).query(`insert into public.categories (deck_id, title) values ($1, 'Examinatorns kategori')`, [draftDeck]);
    await expectDenied(user(db, examiner).query(`insert into public.categories (deck_id, title) values ($1, 'Smyg')`, [otherDeck]));
    const [created] = await user(db, examiner).query<{ id: string }>(`insert into public.cards (deck_id, front, back) values ($1, 'Examinatorns kort', 'Svar') returning id`, [draftDeck]);
    await expectDenied(user(db, examiner).query(`insert into public.cards (deck_id, front, back) values ($1, 'Smyg', 'x')`, [otherDeck]));
    // Andras kort: uppdatering och radering träffar 0 rader.
    await user(db, examiner).query(`update public.cards set back = 'Hackat' where id = $1`, [otherCard]);
    expect((await db.query<{ back: string }>(`select back from public.cards where id = $1`, [otherCard]))[0]?.back).toBe("Annat svar");
    await user(db, examiner).query(`delete from public.cards where id = $1`, [otherCard]);
    expect(await db.query(`select 1 from public.cards where id = $1`, [otherCard])).toHaveLength(1);
    await user(db, examiner).query(`delete from public.cards where id = $1`, [created!.id]);
    expect(await db.query(`select 1 from public.cards where id = $1`, [created!.id])).toHaveLength(0);
  });

  it("examinatorn kan varken skapa eller ta bort deck", async () => {
    await expectDenied(user(db, examiner).query(`insert into public.decks (slug, title) values ('nytt', 'Nytt')`));
    await user(db, examiner).query(`delete from public.decks where id = $1`, [draftDeck]);
    expect(await db.query(`select 1 from public.decks where id = $1`, [draftDeck])).toHaveLength(1);
  });

  it("examinatorn ser statistik och felrapporter bara för sitt deck", async () => {
    await user(db, examiner).query(`select * from public.deck_stats_summary($1)`, [draftDeck]);
    await user(db, examiner).query(`select * from public.deck_stats_cards($1)`, [draftDeck]);
    const [o] = await user(db, examiner).query<{ o: { weeks: unknown[]; categories: unknown[]; rating_dist: unknown[]; progress_buckets: unknown[] } }>(`select public.deck_stats_overview($1, 8) as o`, [draftDeck]);
    expect(o?.o.weeks).toHaveLength(8);
    expect(o?.o.rating_dist).toHaveLength(5);
    expect(o?.o.progress_buckets).toHaveLength(5);
    expect(Array.isArray(o?.o.categories)).toBe(true);
    await expectDenied(user(db, examiner).query(`select * from public.deck_stats_summary($1)`, [otherDeck]));
    await expectDenied(user(db, examiner).query(`select public.deck_stats_overview($1, 8)`, [otherDeck]));
    await expectDenied(user(db, alice).query(`select public.deck_stats_overview($1, 8)`, [draftDeck]));
    await expectDenied(user(db, alice).query(`select * from public.deck_reports($1)`, [draftDeck]));
    await expectDenied(user(db, examiner).query(`select public.deck_open_report_count($1)`, [otherDeck]));

    await db.query(`insert into public.card_reports (card_id, message) values ($1, 'Rapport i examinatorns deck'), ($2, 'Rapport i annat deck')`, [draftCard, otherCard]);
    const seen = await user(db, examiner).query<{ message: string }>(`select message from public.card_reports order by message`);
    expect(seen.map((r) => r.message)).toEqual(["Rapport i examinatorns deck"]);
    const viaRpc = await user(db, examiner).query<{ message: string; card_front: string }>(`select message, card_front from public.deck_reports($1)`, [draftDeck]);
    expect(viaRpc.map((r) => r.message)).toEqual(["Rapport i examinatorns deck"]);
    expect(viaRpc[0]?.card_front).toBe("Hemlig fråga");
    const [cnt] = await user(db, examiner).query<{ n: number }>(`select public.deck_open_report_count($1) as n`, [draftDeck]);
    expect(Number(cnt?.n)).toBe(1);
    await user(db, examiner).query(`update public.card_reports set status = 'resolved' where message = 'Rapport i annat deck'`);
    expect((await db.query<{ status: string }>(`select status from public.card_reports where message = 'Rapport i annat deck'`))[0]?.status).toBe("open");
  });

  it("en väntande inbjudan kopplas automatiskt när kontot registreras, och kan tas bort i förväg", async () => {
    const newcomer = await createUser(db, "Kommande@example.com");
    expect(await db.query(`select 1 from public.deck_examiners where deck_id = $1 and user_id = $2`, [draftDeck, newcomer])).toHaveLength(1);
    expect(await db.query(`select 1 from public.deck_examiner_invites where email = 'kommande@example.com'`)).toHaveLength(0);
    expect(await user(db, newcomer).query(`select id from public.decks where id = $1`, [draftDeck])).toHaveLength(1);
    await user(db, admin).query(`select public.remove_deck_examiner($1, $2)`, [draftDeck, newcomer]);

    await user(db, admin).query(`select public.add_deck_examiner($1, 'annan@example.com')`, [draftDeck]);
    await expectDenied(user(db, alice).query(`select public.remove_deck_examiner_invite($1, 'annan@example.com')`, [draftDeck]));
    const [n] = await user(db, admin).query<{ n: number }>(`select public.remove_deck_examiner_invite($1, 'annan@example.com') as n`, [draftDeck]);
    expect(n?.n).toBe(1);
    const other = await createUser(db, "annan@example.com");
    expect(await db.query(`select 1 from public.deck_examiners where user_id = $1`, [other])).toHaveLength(0);
  });

  it("admin tar bort examinatorn, som därefter inte ser decket", async () => {
    await expectDenied(user(db, examiner).query(`select public.remove_deck_examiner($1, $2)`, [draftDeck, examiner]));
    const [n] = await user(db, admin).query<{ n: number }>(`select public.remove_deck_examiner($1, $2) as n`, [draftDeck, examiner]);
    expect(n?.n).toBe(1);
    expect(await user(db, examiner).query(`select id from public.decks where id = $1`, [draftDeck])).toHaveLength(0);
  });

  it("deck_stats_overview räknar rätt för admin", async () => {
    const [o] = await user(db, admin).query<{
      o: { students: number; open_reports: number; categories: { learned: number; studied: number; avg: number }[]; cards: { ratings: number }[]; progress_buckets: { students: number }[] };
    }>(`select public.deck_stats_overview($1, 8) as o`, [publishedDeck]);
    expect(o?.o.students).toBeGreaterThanOrEqual(1);
    expect(o?.o.categories[0]?.studied).toBeGreaterThanOrEqual(1);
    expect(o?.o.categories[0]?.avg).toBeGreaterThan(0);
    expect(o?.o.cards.some((c) => c.ratings >= 1)).toBe(true);
    expect(o?.o.progress_buckets.reduce((s, b) => s + Number(b.students), 0)).toBe(Number(o?.o.students));
  });
});
