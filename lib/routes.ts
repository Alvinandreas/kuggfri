/**
 * Appens adresser, byggda på ett ställe. Varje byggare ger exakt den sträng som tidigare
 * skrevs för hand vid anropsstället: samma parameterordning, samma kodning (encodeURIComponent
 * bara där den användes, t.ex. next, urval och område på kurssidan) och inga avslutande snedstreck.
 * Kurs-slug, kort-id och liknande kodas inte (de är redan adressäkra), utom i tentafigurernas
 * adress som alltid kodat sina delar.
 *
 * Mönster för sökvägsmatchning (route-gate, middleware) och revalidatePath-mönster med
 * hakparenteser hör inte hit. tests/unit/routes.test.ts underkänner nya handskrivna
 * `/admin/deck/${…}` och `/d/${…}` utanför den här filen. Ren modul.
 */

type QueryValue = string | number | undefined;

/** "?a=1&b=2" av paren i given ordning; värden läggs in som de är (kodas av anroparen). */
function query(pairs: [string, QueryValue][]): string {
  const parts = pairs.filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

/** "1" för en påslagen flagga, annars utelämnad. */
const flag = (on: boolean | undefined): "1" | undefined => (on ? "1" : undefined);

const enc = (v: string | undefined): string | undefined => (v === undefined ? undefined : encodeURIComponent(v));

/** Lägen på kurssidan (?lage=) och områdesfokus (?omrade=, kodat). */
export type DeckParams = { lage?: "exam" | "tricky"; omrade?: string };

/** Ett pass: läge och urval (serialiserat, kodas här). Övriga inställningar läggs till av anroparen. */
export type StudyParams = { mode: string; urval: string };

/** Ett tentaförsök (?forsok=) och om man kom från adminsidan (?fran=admin). */
export type ExamAttemptParams = { forsok?: string; fran?: "admin" };

/** Granskningsinkorgen: flik, öppet kort och område. */
export type ReviewParams = { flik?: string; kort?: string; omrade?: string };

const adminDeck = (id: string) => `/admin/deck/${id}`;
const deckPath = (slug: string) => `/d/${slug}`;

export const routes = {
  /** Landningssidan; next kodas, raderad=1 efter ett borttaget konto. */
  landing: (params?: { next?: string; raderad?: boolean }) => `/${query([["next", enc(params?.next)], ["raderad", flag(params?.raderad)]])}`,
  login: (params?: { next?: string; fel?: "google" | "bekraftelse" | "lank" }) => `/logga-in${query([["next", enc(params?.next)], ["fel", params?.fel]])}`,
  register: (params?: { next?: string }) => `/registrera${query([["next", enc(params?.next)]])}`,
  forgotPassword: () => "/glomt-losenord",
  home: () => "/hem",
  courses: () => "/kurser",
  myStats: () => "/statistik",
  account: (params?: { bytLosenord?: boolean }) => `/konto${query([["byt-losenord", flag(params?.bytLosenord)]])}`,
  accountExport: () => "/api/konto/export",
  help: () => "/hjalp",
  about: () => "/om",
  privacy: () => "/integritet",
  designSystem: () => "/designsystem",
  /** Kursens inbjudningssida för utloggade. */
  courseInvite: (slug: string) => `/kurs/${slug}`,
  authGoogle: (params?: { next?: string }) => `/auth/google${query([["next", enc(params?.next)]])}`,
  authGoogleCallback: () => "/auth/google/callback",
  authConfirm: (params?: { next?: string }) => `/auth/confirm${query([["next", enc(params?.next)]])}`,

  /** Kurssidan. */
  deck: (slug: string, params?: DeckParams) => `${deckPath(slug)}${query([["lage", params?.lage], ["omrade", enc(params?.omrade)]])}`,
  /** Pluggpasset; utan parametrar bara sökvägen. */
  study: (slug: string, params?: StudyParams) => `${deckPath(slug)}/plugga${params ? query([["mode", params.mode], ["urval", encodeURIComponent(params.urval)]]) : ""}`,
  /** Tentaläget (listan med tentor). */
  exam: (slug: string) => `${deckPath(slug)}/tenta`,
  /** En tenta: försättsblad, pågående försök eller resultat. */
  examAttempt: (slug: string, key: string, params?: ExamAttemptParams) => `${deckPath(slug)}/tenta/${key}${query([["forsok", params?.forsok], ["fran", params?.fran]])}`,
  /** Figur nr index i en tentauppgift; alla delar kodas, v byter adress när figuren ändras. */
  examImage: (slug: string, key: string, questionId: string, index: number, v: string) =>
    `/d/${encodeURIComponent(slug)}/tenta/${encodeURIComponent(key)}/bild/${encodeURIComponent(questionId)}/${index}?v=${v}`,

  admin: {
    home: () => "/admin",
    /** Alla kurser. */
    decks: () => "/admin/deck",
    newDeck: () => "/admin/deck/ny",
    /** Kursens översikt. */
    deck: (id: string) => adminDeck(id),
    stats: (id: string) => `${adminDeck(id)}/statistik`,
    content: (id: string) => `${adminDeck(id)}/innehall`,
    review: (id: string, params?: ReviewParams) => `${adminDeck(id)}/granskning${query([["flik", params?.flik], ["kort", params?.kort], ["omrade", params?.omrade]])}`,
    exams: (id: string) => `${adminDeck(id)}/tentor`,
    examKey: (id: string, key: string) => `${adminDeck(id)}/tentor/${key}`,
    reports: (id: string) => `${adminDeck(id)}/rapporter`,
    import: (id: string) => `${adminDeck(id)}/import`,
    export: (id: string) => `${adminDeck(id)}/export`,
    /** Statistiken som CSV: per område eller per kort. */
    statsCsv: (id: string, level: "omraden" | "kort") => `${adminDeck(id)}/export/statistik${query([["niva", level]])}`,
    settings: (id: string) => `${adminDeck(id)}/installningar`,
    /** Ett område; "ingen" för kort utan område. */
    category: (id: string, categoryId: string) => `${adminDeck(id)}/kategori/${categoryId}`,
    /** Allt under områdena (sidomenyns Innehåll är aktiv där). */
    categoryPrefix: (id: string) => `${adminDeck(id)}/kategori`,
    card: (id: string, cardId: string) => `${adminDeck(id)}/kort/${cardId}`,
    /** Allt under korten (sidomenyns Innehåll är aktiv där). */
    cardPrefix: (id: string) => `${adminDeck(id)}/kort`,
    newCard: (id: string, params?: { kategori?: string }) => `${adminDeck(id)}/kort/ny${query([["kategori", params?.kategori]])}`,
    cardHistory: (id: string, cardId: string) => `${adminDeck(id)}/kort/${cardId}/historik`,
  },
} as const;
