/**
 * Deltagarlistorna (supabase/migrations/20261002000300_deltagarlistor.sql): registreringen är
 * stängd för adresser utanför listorna, kontot kopplas till listan när adressen är bekräftad,
 * och bara kursens deltagare (och redaktörer) läser kursens kort.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createTestDb, createUser, expectDenied, user, type RawDb } from "./harness";

let db: RawDb;
let admin: string;
let examiner: string;
let deck: string;
let otherDeck: string;

beforeAll(async () => {
  db = await createTestDb();
  admin = await createUser(db, "admin@example.com", { admin: true });
  examiner = await createUser(db, "examinator@example.com");
  const decks = await db.query<{ id: string; slug: string }>(
    `insert into public.decks (slug, title, is_published) values ('kursen', 'Kursen', true), ('annan', 'Annan kurs', true) returning id, slug`,
  );
  deck = decks.find((d) => d.slug === "kursen")!.id;
  otherDeck = decks.find((d) => d.slug === "annan")!.id;
  await db.query(`insert into public.deck_examiners (deck_id, user_id) values ($1, $2)`, [deck, examiner]);
  await db.query(`insert into public.cards (deck_id, front, back) values ($1, 'Kursens fråga', 'Svar'), ($2, 'Annan fråga', 'Svar')`, [deck, otherDeck]);
});

afterAll(async () => {
  await db?.close();
});

/** En vanlig registrering (som Supabase Auth gör den), obekräftad tills bekräftelselänken öppnas. */
const signUp = (email: string) => createUser(db, email, { selfSignup: true, confirmed: false });
const confirm = (id: string) => db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [id]);
const add = (as: string, d: string, emails: string[]) =>
  user(db, as).query<{ added: number; already: number; linked: number }>(`select * from public.add_deck_enrollments($1, $2::text[])`, [d, emails]);

describe("registreringen", () => {
  it("är stängd för adresser som inte står på någon deltagarlista", async () => {
    await expectDenied(signUp("okand@example.com"), /deltagarlista/);
  });

  it("är öppen för adresser på en lista, oavsett skiftläge", async () => {
    await add(examiner, deck, ["Lisa@Example.com"]);
    const id = await signUp("lisa@example.com");
    expect(id).toBeTruthy();
  });

  it("är öppen för den som har en examinatorinbjudan", async () => {
    await db.query(`insert into public.deck_examiner_invites (deck_id, email) values ($1, 'ny.examinator@example.com')`, [deck]);
    expect(await signUp("ny.examinator@example.com")).toBeTruthy();
  });

  it("släpper igenom konton som skript skapar via admin-API:t", async () => {
    expect(await createUser(db, "skript@example.com")).toBeTruthy();
  });

  it("kan inte prövas av gäster eller inloggade (ingen läcka om vem som läser en kurs)", async () => {
    await expectDenied(anon(db).query(`select public.email_may_register('lisa@example.com')`));
    await expectDenied(user(db, examiner).query(`select public.email_may_register('lisa@example.com')`));
  });
});

describe("kopplingen till kontot", () => {
  it("sker först när adressen är bekräftad, och ger då kursens kort", async () => {
    await add(examiner, deck, ["kalle@example.com"]);
    const kalle = await signUp("kalle@example.com");
    expect(await user(db, kalle).query(`select id from public.cards`)).toHaveLength(0);
    await confirm(kalle);
    const cards = await user(db, kalle).query<{ front: string }>(`select front from public.cards`);
    expect(cards.map((c) => c.front)).toEqual(["Kursens fråga"]);
    const ids = await user(db, kalle).query<{ my_deck_ids: string }>(`select public.my_deck_ids()`);
    expect(ids.map((r) => r.my_deck_ids)).toEqual([deck]);
  });

  it("sker direkt när en adress med bekräftat konto läggs till i efterhand", async () => {
    const sara = await createUser(db, "sara@example.com");
    expect(await user(db, sara).query(`select id from public.cards`)).toHaveLength(0);
    const [res] = await add(examiner, deck, ["sara@example.com"]);
    expect(res).toEqual({ added: 1, already: 0, linked: 1 });
    expect(await user(db, sara).query(`select id from public.cards`)).toHaveLength(1);
  });
});

describe("redaktörernas funktioner", () => {
  it("lägger till i klump, hoppar över ogiltiga och räknar dubbletter en gång", async () => {
    const [res] = await add(examiner, deck, ["a@example.com", "A@example.com ", "b@example.com", "inte-en-adress", "lisa@example.com"]);
    expect(res).toEqual({ added: 2, already: 1, linked: 0 });
  });

  it("nekar studenter och examinatorer för andra kurser", async () => {
    const student = await createUser(db, "student@example.com");
    await expectDenied(add(student, deck, ["x@example.com"]));
    await expectDenied(add(examiner, otherDeck, ["x@example.com"]));
    await expectDenied(user(db, student).query(`select * from public.list_deck_enrollments($1)`, [deck]));
    await expectDenied(user(db, student).query(`select * from public.deck_enrollments`));
  });

  it("examinatorn ser listan och antalet men inte vem som skapat konto; admin ser det", async () => {
    const asExaminer = await user(db, examiner).query<{ email: string; registered: boolean | null }>(`select * from public.list_deck_enrollments($1)`, [deck]);
    expect(asExaminer.find((r) => r.email === "kalle@example.com")?.registered).toBeNull();
    const asAdmin = await user(db, admin).query<{ email: string; registered: boolean | null }>(`select * from public.list_deck_enrollments($1)`, [deck]);
    expect(asAdmin.find((r) => r.email === "kalle@example.com")?.registered).toBe(true);
    expect(asAdmin.find((r) => r.email === "a@example.com")?.registered).toBe(false);
    const [counts] = await user(db, examiner).query<{ total: number; registered: number }>(`select * from public.deck_enrollment_counts($1)`, [deck]);
    expect(counts).toEqual({ total: asAdmin.length, registered: asAdmin.filter((r) => r.registered).length });
  });

  it("den som tas bort från listan förlorar kursen, men kontot finns kvar", async () => {
    const [sara] = await db.query<{ id: string }>(`select id from auth.users where email = 'sara@example.com'`);
    const [n] = await user(db, examiner).query<{ remove_deck_enrollments: number }>(`select public.remove_deck_enrollments($1, $2::text[])`, [deck, ["SARA@example.com"]]);
    expect(n?.remove_deck_enrollments).toBe(1);
    expect(await user(db, sara!.id).query(`select id from public.cards`)).toHaveLength(0);
    expect(await db.query(`select 1 from public.profiles where id = $1`, [sara!.id])).toHaveLength(1);
  });

  it("redaktören läser kursens kort utan att stå på listan", async () => {
    expect(await user(db, examiner).query(`select id from public.cards where deck_id = $1`, [deck])).toHaveLength(1);
  });
});
