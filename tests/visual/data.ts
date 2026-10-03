/**
 * Testdata för det visuella regressionstestet: en egen teststudent och en egen testexaminator
 * med fast, framräknad progress, så att hemsidan, statistiken, radarn och kurssidan visar
 * samma innehåll vid varje körning. Skapas i global-setup.ts och tas bort i global-teardown.ts.
 *
 * All tid räknas från VISUAL_NOW, där också klientens klocka börjar i testerna (fixtures.ts). Datan
 * ser därför likadan ut vilken dag testet än körs. Modulen importerar ingen appkod, så att den
 * fortsätter fungera medan appen refaktoreras.
 *
 * Materialteknik och admin@kuggfri.test används som de är; här ändras inget av deras innehåll.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

/** Klientens klocka i testerna: onsdag 30 september 2026 kl. 10.00 svensk tid. */
export const VISUAL_NOW = new Date("2026-09-30T08:00:00.000Z");

export const DECK_SLUG = "materialteknik";

export const ADMIN = { email: "admin@kuggfri.test", password: "admin-losenord-123" };
export const STUDENT = { email: "visual-student@kuggfri.test", password: "visuell-student-123", name: "Vera Visuell" };
export const EXAMINER = { email: "visual-examinator@kuggfri.test", password: "visuell-examinator-123", name: "Erik Examinator" };

/** Inloggningar och id:n som setup räknat fram (gitignorerad katalog). */
export const STATE_DIR = path.join(__dirname, ".state");
export const AUTH_FILE = {
  student: path.join(STATE_DIR, "student.json"),
  admin: path.join(STATE_DIR, "admin.json"),
  examiner: path.join(STATE_DIR, "examiner.json"),
} as const;
const FIXTURE_FILE = path.join(STATE_DIR, "fixture.json");

/** Det testerna behöver veta om datan: id:n och adresser som räknas fram ur databasen. */
export type Fixture = {
  deckId: string;
  /** Området med radarns första axel och kurssidans första rad. */
  firstCategory: { id: string; title: string };
  /** Ett pass som börjar med ett självskattningskort (fri repetition i kursens ordning). */
  selfRatingArea: { id: string; title: string; cards: number };
  /** Ett pass som börjar med ett begreppskort. */
  conceptArea: { id: string; title: string };
  /** Stjärnmärkt kort (sparas på enheten, se tests/visual/fixtures.ts). */
  starredCardId: string;
  /** Kort för adminens redigeringsvy. */
  editCardId: string;
  /** Flaggat kort för granskningens flaggade vy. */
  flaggedCardId: string | null;
  /** Tentan vars försättsblad visas, och den som har ett påbörjat förhandsgranskningsförsök. */
  coverExamKey: string;
  runnerExamKey: string;
  runnerAttemptId: string;
};

export function readFixture(): Fixture {
  if (!existsSync(FIXTURE_FILE)) throw new Error(`Saknar ${FIXTURE_FILE}. Kör via "npm run test:visual" så att global-setup skapar den.`);
  return JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as Fixture;
}

export { FIXTURE_FILE };

/** Service role-nyckeln ur .env.local (eller miljön). Bara här i testerna, aldrig i appen. */
function serviceRoleKey(): string {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const envFile = path.join(__dirname, "..", "..", ".env.local");
  if (existsSync(envFile)) {
    const match = /^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m.exec(readFileSync(envFile, "utf8"));
    if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("Hittade ingen SUPABASE_SERVICE_ROLE_KEY i miljön eller .env.local.");
}

export function isLocal(url: string = SUPABASE_URL): boolean {
  const host = new URL(url).hostname;
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
}

export function service(): SupabaseClient {
  if (!isLocal()) throw new Error(`Det visuella testet körs bara mot en lokal Supabase, inte ${SUPABASE_URL}.`);
  return createClient(SUPABASE_URL, serviceRoleKey(), { auth: { autoRefreshToken: false, persistSession: false } });
}

const DAY = 24 * 60 * 60 * 1000;

/** Ett klockslag (svensk sommartid, UTC+2) ett antal dagar före VISUAL_NOW. */
function at(daysAgo: number, hour: number, minute = 0): Date {
  const base = new Date(VISUAL_NOW.getTime() - daysAgo * DAY);
  base.setUTCHours(hour - 2, minute, 0, 0);
  return base;
}

/**
 * Hur många kort per område (i kursens ordning) studenten sett, och skattningarna i tur och
 * ordning. Ger radarn olika nivåer, några kluriga kort (1–2) och flera områden helt osedda.
 */
const SEEN_PER_AREA: readonly (readonly (1 | 2 | 3 | 4 | 5)[])[] = [
  [5, 4, 4, 3, 5, 2, 4, 5],
  [4, 3, 5, 2],
  [3, 1, 4],
  [2, 3, 4, 3, 1],
  [5, 5, 4],
  [4, 2, 3, 5],
  [1, 2],
  [3, 4, 4],
  [4, 5, 3, 2, 4, 3],
];

/** FSRS-tillståndet per skattning: fasta, rimliga värden (inte appens schemaläggare). */
const FSRS_BY_RATING = {
  1: { stability: 0.4, difficulty: 8.2, state: 3, lapses: 1, interval: 1 },
  2: { stability: 1.3, difficulty: 6.9, state: 1, lapses: 0, interval: 1 },
  3: { stability: 3.8, difficulty: 5.4, state: 2, lapses: 0, interval: 4 },
  4: { stability: 8.6, difficulty: 4.3, state: 2, lapses: 0, interval: 9 },
  5: { stability: 19.5, difficulty: 2.6, state: 2, lapses: 0, interval: 20 },
} as const;

type Card = { id: string; kind: string; category_id: string | null; sort_order: number; front: string };
type Category = { id: string; title: string; sort_order: number };

async function userIdByEmail(db: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Kunde inte lista användarna: ${error.message}`);
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Tar bort testanvändarna; progress, historik, examinatorsrad och tentaförsök följer med (cascade). */
export async function removeVisualUsers(db: SupabaseClient = service()): Promise<void> {
  for (const email of [STUDENT.email, EXAMINER.email]) {
    const id = await userIdByEmail(db, email);
    if (!id) continue;
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) throw new Error(`Kunde inte ta bort ${email}: ${error.message}`);
  }
}

/** Tar bort adminens förhandsgranskningsförsök som setup skapade. */
export async function removeRunnerAttempt(db: SupabaseClient = service()): Promise<void> {
  if (!existsSync(FIXTURE_FILE)) return;
  const { runnerAttemptId } = readFixture();
  if (runnerAttemptId) await db.from("exam_attempts").delete().eq("id", runnerAttemptId);
}

async function createUser(db: SupabaseClient, user: { email: string; password: string; name: string }): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { display_name: user.name },
  });
  if (error || !data.user) throw new Error(`Kunde inte skapa ${user.email}: ${error?.message}`);
  const { error: profileError } = await db.from("profiles").update({ display_name: user.name }).eq("id", data.user.id);
  if (profileError) throw new Error(`Kunde inte sätta namnet på ${user.email}: ${profileError.message}`);
  return data.user.id;
}

/** Skapar testanvändarna och deras data. Returnerar det testerna behöver veta. */
export async function seedVisualData(): Promise<Fixture> {
  const db = service();
  await removeRunnerAttempt(db);
  await removeVisualUsers(db);

  const { data: deck, error: deckError } = await db.from("decks").select("id").eq("slug", DECK_SLUG).single();
  if (deckError || !deck) throw new Error(`Hittade inte kursen ${DECK_SLUG}: ${deckError?.message}`);
  const deckId = deck.id as string;

  const { data: catRows, error: catError } = await db.from("categories").select("id, title, sort_order").eq("deck_id", deckId).order("sort_order");
  if (catError) throw new Error(catError.message);
  const { data: cardRows, error: cardError } = await db
    .from("cards")
    .select("id, kind, category_id, sort_order, front")
    .eq("deck_id", deckId)
    .eq("is_active", true)
    .order("sort_order");
  if (cardError) throw new Error(cardError.message);
  const categories = (catRows ?? []) as Category[];
  const cards = (cardRows ?? []) as Card[];
  const cardsIn = (c: Category) => cards.filter((x) => x.category_id === c.id).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const withCards = categories.filter((c) => cardsIn(c).length > 0);
  if (withCards.length < SEEN_PER_AREA.length) throw new Error("Kursen har färre områden med kort än testdatan räknar med.");

  // Studenten på kursens deltagarlista och examinatorn inbjuden, innan kontona skapas: utan det
  // stoppar registreringsspärren dem (supabase/migrations/20261002000300_deltagarlistor.sql).
  const { error: enrollError } = await db.from("deck_enrollments").upsert({ deck_id: deckId, email: STUDENT.email.toLowerCase() }, { onConflict: "deck_id,email" });
  if (enrollError) throw new Error(`Kunde inte sätta studenten på deltagarlistan: ${enrollError.message}`);
  const { error: inviteError } = await db.from("deck_examiner_invites").upsert({ deck_id: deckId, email: EXAMINER.email.toLowerCase() }, { onConflict: "deck_id,email" });
  if (inviteError) throw new Error(`Kunde inte bjuda in examinatorn: ${inviteError.message}`);

  const studentId = await createUser(db, STUDENT);
  const examinerId = await createUser(db, EXAMINER);

  // Examinatorn för Materialteknik, med fast datum så att listan i Inställningar inte ändras.
  const { error: exError } = await db.from("deck_examiners").upsert({ deck_id: deckId, user_id: examinerId, created_at: at(20, 9).toISOString() }, { onConflict: "deck_id,user_id" });
  if (exError) throw new Error(`Kunde inte lägga till examinatorn: ${exError.message}`);

  // Progress och historik, framräknade ur tabellen ovan.
  const progress: Record<string, unknown>[] = [];
  const reviews: Record<string, unknown>[] = [];
  let n = 0;
  SEEN_PER_AREA.forEach((ratings, areaIndex) => {
    const area = withCards[areaIndex]!;
    cardsIn(area)
      .slice(0, ratings.length)
      .forEach((card, i) => {
        const rating = ratings[i]!;
        const f = FSRS_BY_RATING[rating];
        // Senaste repetitionen 0–13 dagar sedan; några i dag (kl. 7–9), resten på kvällen.
        const daysAgo = (n * 5) % 14;
        const last = daysAgo === 0 ? at(0, 7 + (n % 3), (n * 7) % 60) : at(daysAgo, 17 + (n % 4), (n * 11) % 60);
        const reps = 1 + (n % 4);
        const due = new Date(last.getTime() + f.interval * DAY);
        progress.push({
          user_id: studentId,
          card_id: card.id,
          due: due.toISOString(),
          stability: f.stability,
          difficulty: f.difficulty,
          elapsed_days: Math.max(0, daysAgo - 1),
          scheduled_days: f.interval,
          reps,
          lapses: f.lapses,
          state: f.state,
          last_review: last.toISOString(),
          self_rating: rating,
        });
        // En rad per repetition: den senaste med kortets skattning, de tidigare några dagar innan.
        for (let r = 0; r < reps; r++) {
          const when = r === 0 ? last : at(daysAgo + 2 * r + (n % 2), 16 + ((n + r) % 5), (n * 13 + r * 7) % 60);
          const earlier = r === 0 ? rating : Math.max(1, rating - 1);
          reviews.push({ user_id: studentId, card_id: card.id, rating: earlier, mode: r % 3 === 2 ? "free" : "fsrs", reviewed_at: when.toISOString() });
        }
        n++;
      });
  });
  // Några repetitioner av samma kort längre bak, så att aktiviteten och rytmen får historik.
  const historyCards = progress.slice(0, 6).map((p) => p.card_id as string);
  for (let d = 15; d <= 27; d += 2) {
    historyCards.forEach((cardId, i) => {
      if ((d + i) % 3 === 0) return;
      reviews.push({ user_id: studentId, card_id: cardId, rating: 2 + ((d + i) % 4), mode: "fsrs", reviewed_at: at(d, 19, (i * 9) % 60).toISOString() });
    });
  }

  const { error: pError } = await db.from("card_progress").insert(progress);
  if (pError) throw new Error(`Kunde inte skriva progress: ${pError.message}`);
  const { error: rError } = await db.from("review_log").insert(reviews);
  if (rError) throw new Error(`Kunde inte skriva historiken: ${rError.message}`);
  const sessions = [3, 6, 9, 13].map((d, i) => ({
    user_id: studentId,
    deck_id: deckId,
    mode: i === 2 ? "free" : "fsrs",
    started_at: at(d, 18, 0).toISOString(),
    ended_at: at(d, 18, 12 + i).toISOString(),
    cards_reviewed: 6 + i * 2,
  }));
  const { error: sError } = await db.from("study_sessions").insert(sessions);
  if (sError) throw new Error(`Kunde inte skriva passen: ${sError.message}`);

  // Passen: ett område som börjar med ett självskattningskort och ett som börjar med ett begreppskort.
  const selfArea = withCards.find((c) => cardsIn(c)[0]?.kind === "sjalvskattning" && cardsIn(c).length <= 7) ?? withCards[0]!;
  const conceptArea = withCards.find((c) => cardsIn(c)[0]?.kind === "begrepp") ?? withCards[0]!;

  // Ett kort att redigera: områdets första begreppskort om det finns, annars kursens första kort.
  const editCard = cards.find((c) => c.kind === "begrepp") ?? cards[0]!;

  const { data: flagged } = await db
    .from("cards")
    .select("id, sort_order")
    .eq("deck_id", deckId)
    .not("flagged_at", "is", null)
    .order("sort_order")
    .order("id")
    .limit(1);

  // Tentorna i kursordning: försättsbladet på den första, förhandsgranskningen på den andra.
  const { data: exams, error: examError } = await db.from("exams").select("id, key").eq("deck_id", deckId).order("key");
  if (examError || !exams || exams.length < 2) throw new Error(`Kursen behöver minst två tentor: ${examError?.message ?? ""}`);
  const coverExam = exams[0]!;
  const runnerExam = exams[1]!;
  const adminId = await userIdByEmail(db, ADMIN.email);
  if (!adminId) throw new Error(`Hittade inte ${ADMIN.email}. Kör "npm run db:reset" eller E2E-setupen först.`);
  const { data: attempt, error: aError } = await db
    .from("exam_attempts")
    .insert({ user_id: adminId, exam_id: runnerExam.id, started_at: new Date().toISOString() })
    .select("id")
    .single();
  if (aError || !attempt) throw new Error(`Kunde inte skapa förhandsgranskningsförsöket: ${aError?.message}`);

  return {
    deckId,
    firstCategory: { id: withCards[0]!.id, title: withCards[0]!.title },
    selfRatingArea: { id: selfArea.id, title: selfArea.title, cards: cardsIn(selfArea).length },
    conceptArea: { id: conceptArea.id, title: conceptArea.title },
    starredCardId: (progress[1]!.card_id as string) ?? cards[0]!.id,
    editCardId: editCard.id,
    flaggedCardId: (flagged?.[0]?.id as string | undefined) ?? null,
    coverExamKey: coverExam.key as string,
    runnerExamKey: runnerExam.key as string,
    runnerAttemptId: attempt.id as string,
  };
}
