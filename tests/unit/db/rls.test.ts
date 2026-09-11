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
