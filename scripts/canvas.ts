/**
 * kuggfri canvas – hämtar kursmaterial från Canvas till material/<kurs>/ (utanför git).
 *
 *   npm run kuggfri -- canvas inventera <kurs>   moduler, filer, sidor och quizzar → inventering.md
 *   npm run kuggfri -- canvas hamta <kurs>       laddar ner nya/ändrade filer, sidor och quizfrågor
 *   npm run kuggfri -- canvas text <kurs>        tar ut text ur PDF/DOCX/PPTX till material/<kurs>/text/
 *   npm run kuggfri -- canvas quizkort <kurs>    quizfrågorna som utkastkort (Alternativ) i material/<kurs>/forslag/
 *
 * Token: CANVAS_TOKEN i .env.local (Alvins personliga TA-token, skapas under Konto → Inställningar).
 *
 * Integritet: token når allt Alvin når i Canvas, även studentdata. Verktyget gör därför bara
 * GET-anrop, bara mot kurser i KURSER nedan, och vägrar alla sökvägar som rör användare,
 * inlämningar eller betyg. Materialet stannar lokalt (material/ är gitignorerad).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { serializeCardFile } from "@/lib/content/markdown";
import { slugifyKey, uniqueKey, type ContentCard } from "@/lib/content/model";
import { loadCourse } from "@/lib/content/store";
import { lines } from "@/lib/text/newlines";
import { ROOT } from "./cli/args";
import { say } from "./cli/output";

/** Tillåtelselistan: kursnyckel i content/ → Canvaskurs. Lägg till en rad per ny kurs. */
const KURSER: Record<string, { base: string; courseId: number }> = {
  materialteknik: { base: "https://chalmers.instructure.com", courseId: 40969 },
};

/** Filer som aldrig laddas ner: video, ljud och 3D-modeller (stora och utan text). */
const HOPPA_OVER = new Set([".mp4", ".m4v", ".mov", ".mp3", ".usdz", ".reality", ".zip"]);
const MAX_BYTES = 200 * 1024 * 1024;

const FORBJUDET = /\/(users|enrollments|submissions|students|grades|gradebook|analytics|conversations|sections|groups|recipients|search_users|participants|results|quiz_submissions|sessions)\b/i;

// ---------------------------------------------------------------------------

function token(): string {
  if (process.env.CANVAS_TOKEN) return process.env.CANVAS_TOKEN.trim();
  const envFile = join(ROOT, ".env.local");
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, "utf8").match(/^CANVAS_TOKEN=(.*)$/m);
    if (m?.[1]) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("CANVAS_TOKEN saknas i .env.local.");
}

type Kurs = { key: string; base: string; courseId: number; dir: string };

function kurs(key: string | undefined): Kurs {
  if (!key) throw new Error(`Ange kurs: ${Object.keys(KURSER).join(", ")}`);
  const k = KURSER[key];
  if (!k) throw new Error(`Kursen "${key}" finns inte på tillåtelselistan i scripts/canvas.ts.`);
  return { key, ...k, dir: join(ROOT, "material", key) };
}

/** Den enda vägen ut mot Canvas: GET, rätt kurs, inga persondata-sökvägar. */
async function get(k: Kurs, path: string): Promise<Response> {
  const url = new URL(path, k.base);
  const api = `/api/v1/courses/${k.courseId}`;
  const quiz = `/api/quiz/v1/courses/${k.courseId}/`;
  const kursPrefix = url.pathname === api || url.pathname.startsWith(api + "/") || url.pathname.startsWith(quiz);
  if (url.origin !== k.base || !kursPrefix || FORBJUDET.test(url.pathname)) {
    throw new Error(`Vägrar anrop utanför tillåtet område: ${url.pathname}`);
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error(`Canvas svarade ${res.status} på ${url.pathname}`);
  return res;
}

/**
 * Filens nedladdningslänk ur fillistan (/files/<id>/download?verifier=…) ligger utanför API:t.
 * Släpps bara igenom för exakt den filen, som redan har hämtats ur kursens egen fillista.
 * Canvas omdirigerar till lagringen; fetch följer omdirigeringen och tappar då Authorization.
 */
async function laddaNer(k: Kurs, f: CanvasFile): Promise<Uint8Array> {
  const url = new URL(f.url, k.base);
  if (url.origin !== k.base || url.pathname !== `/files/${f.id}/download`) throw new Error(`Oväntad nedladdningslänk: ${url.pathname}`);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error(`Canvas svarade ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function getAll<T>(k: Kurs, path: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = `${path}${path.includes("?") ? "&" : "?"}per_page=100`;
  while (next) {
    const res = await get(k, next);
    out.push(...((await res.json()) as T[]));
    const m = (res.headers.get("link") ?? "").match(/<([^>]+)>;\s*rel="next"/);
    next = m?.[1] ?? null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Typer (bara fälten vi använder)
// ---------------------------------------------------------------------------

type CanvasFile = { id: number; display_name: string; size: number; updated_at: string; url: string; folder_id: number; "content-type": string };
type ModuleItem = { type: string; title: string; content_id?: number; page_url?: string; external_url?: string };
type Module = { id: number; name: string; position: number; items?: ModuleItem[] };
type Page = { url: string; title: string; updated_at: string; body?: string };
type Assignment = { id: number; name: string; is_quiz_lti_assignment?: boolean; submission_types?: string[]; due_at: string | null };

type Manifest = {
  hamtad: string;
  filer: Record<string, { namn: string; sokvag: string; storlek: number; updated_at: string; modul: string }>;
};

function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._ -]+/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 90);
}

function readManifest(k: Kurs): Manifest {
  const f = join(k.dir, "manifest.json");
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Manifest) : { hamtad: "", filer: {} };
}

function write(path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

function htmlTillText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// inventera
// ---------------------------------------------------------------------------

type Inventering = { modules: Module[]; files: CanvasFile[]; pages: Page[]; quizzes: Assignment[] };

async function inventera(k: Kurs): Promise<Inventering> {
  const [modules, files, pages, assignments] = await Promise.all([
    getAll<Module>(k, `/api/v1/courses/${k.courseId}/modules?include[]=items`),
    getAll<CanvasFile>(k, `/api/v1/courses/${k.courseId}/files`),
    getAll<Page>(k, `/api/v1/courses/${k.courseId}/pages`),
    getAll<Assignment>(k, `/api/v1/courses/${k.courseId}/assignments`),
  ]);
  const quizzes = assignments.filter((a) => a.is_quiz_lti_assignment || /quiz/i.test(a.name));
  return { modules: modules.sort((a, b) => a.position - b.position), files, pages, quizzes };
}

function modulFor(inv: Inventering): Map<number, string> {
  const m = new Map<number, string>();
  for (const mod of inv.modules) for (const it of mod.items ?? []) if (it.type === "File" && it.content_id) m.set(it.content_id, mod.name);
  return m;
}

async function cmdInventera(k: Kurs): Promise<void> {
  const inv = await inventera(k);
  const modul = modulFor(inv);
  const rader: string[] = [`# Inventering av ${k.key} (Canvas ${k.courseId})`, "", `Hämtad ${new Date().toISOString()}.`, ""];
  for (const mod of inv.modules) {
    rader.push(`## ${mod.name}`, "");
    for (const it of mod.items ?? []) {
      if (it.type === "SubHeader") rader.push(`- *${it.title}*`);
      else rader.push(`- [${it.type}] ${it.title}`);
    }
    rader.push("");
  }
  const utanModul = inv.files.filter((f) => !modul.has(f.id));
  rader.push(`## Filer utanför moduler (${utanModul.length})`, "", ...utanModul.map((f) => `- ${f.display_name}`), "");
  rader.push("## Sidor", "", ...inv.pages.map((p) => `- ${p.title}`), "");
  rader.push("## Quizzar", "", ...inv.quizzes.map((q) => `- ${q.name}`), "");
  const hamtas = inv.files.filter((f) => !HOPPA_OVER.has(extname(f.display_name).toLowerCase()) && f.size <= MAX_BYTES);
  const mb = (n: number) => `${(n / 1e6).toFixed(0)} MB`;
  rader.push(
    "## Summering",
    "",
    `- ${inv.files.length} filer totalt (${mb(inv.files.reduce((s, f) => s + f.size, 0))})`,
    `- ${hamtas.length} hämtas (${mb(hamtas.reduce((s, f) => s + f.size, 0))}); video, ljud och 3D hoppas över`,
    "",
  );
  write(join(k.dir, "inventering.md"), rader.join("\n"));
  write(join(k.dir, "inventering.json"), JSON.stringify(inv, null, 2));
  say(`Skrev material/${k.key}/inventering.md: ${inv.modules.length} moduler, ${inv.files.length} filer, ${inv.pages.length} sidor, ${inv.quizzes.length} quizzar.`);
  say(`${hamtas.length} filer (${mb(hamtas.reduce((s, f) => s + f.size, 0))}) skulle hämtas av \`canvas hamta\`.`);
}

// ---------------------------------------------------------------------------
// hamta
// ---------------------------------------------------------------------------

async function cmdHamta(k: Kurs): Promise<void> {
  const inv = await inventera(k);
  write(join(k.dir, "inventering.json"), JSON.stringify(inv, null, 2));
  const modul = modulFor(inv);
  const manifest = readManifest(k);
  let nya = 0;
  let oforandrade = 0;
  let hoppade = 0;
  let fel = 0;

  for (const f of inv.files) {
    const ext = extname(f.display_name).toLowerCase();
    if (HOPPA_OVER.has(ext) || f.size > MAX_BYTES) {
      hoppade++;
      continue;
    }
    const mod = modul.get(f.id) ?? "Utanför moduler";
    const sokvag = join("filer", slug(mod), `${f.id}-${slug(f.display_name)}`);
    const tidigare = manifest.filer[String(f.id)];
    if (tidigare && tidigare.updated_at === f.updated_at && existsSync(join(k.dir, tidigare.sokvag))) {
      oforandrade++;
      continue;
    }
    try {
      write(join(k.dir, sokvag), await laddaNer(k, f));
      manifest.filer[String(f.id)] = { namn: f.display_name, sokvag, storlek: f.size, updated_at: f.updated_at, modul: mod };
      write(join(k.dir, "manifest.json"), JSON.stringify(manifest, null, 2));
      nya++;
      say(`  ↓ ${mod} / ${f.display_name}`);
    } catch (e) {
      fel++;
      say(`  ✗ ${f.display_name}: ${e instanceof Error ? e.message : e}`);
    }
  }

  for (const p of inv.pages) {
    const full = (await (await get(k, `/api/v1/courses/${k.courseId}/pages/${encodeURIComponent(p.url)}`)).json()) as Page;
    write(join(k.dir, "sidor", `${slug(p.title)}.md`), `# ${p.title}\n\n${htmlTillText(full.body ?? "")}\n`);
  }
  const syllabus = (await (await get(k, `/api/v1/courses/${k.courseId}?include[]=syllabus_body`)).json()) as { syllabus_body?: string };
  if (syllabus.syllabus_body) write(join(k.dir, "sidor", "kursplan.md"), `# Kursplan (Canvas)\n\n${htmlTillText(syllabus.syllabus_body)}\n`);

  // Anslag: bara lärarnas inlägg (titel, datum, text). Svar och författare hämtas aldrig.
  const anslag = await getAll<{ title: string; posted_at: string | null; message: string | null }>(
    k,
    `/api/v1/courses/${k.courseId}/discussion_topics?only_announcements=true`,
  );
  const sorted = [...anslag].sort((a, b) => (b.posted_at ?? "").localeCompare(a.posted_at ?? ""));
  write(
    join(k.dir, "sidor", "anslag.md"),
    `# Anslag (Canvas)\n\n${sorted.map((a) => `## ${a.title}\n_${a.posted_at?.slice(0, 10) ?? "odaterat"}_\n\n${htmlTillText(a.message ?? "")}\n`).join("\n")}`,
  );
  say(`  ${anslag.length} anslag`);

  let quizzar = 0;
  for (const q of inv.quizzes) {
    try {
      const items = await getAll<unknown>(k, `/api/quiz/v1/courses/${k.courseId}/quizzes/${q.id}/items`);
      write(join(k.dir, "quizzar", `${q.id}-${slug(q.name)}.json`), JSON.stringify(items, null, 2));
      quizzar++;
    } catch (e) {
      say(`  (quiz "${q.name}": ${e instanceof Error ? e.message : e})`);
    }
  }

  manifest.hamtad = new Date().toISOString();
  write(join(k.dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  say(`Klart: ${nya} nya/ändrade filer, ${oforandrade} oförändrade, ${hoppade} hoppade över (video/3D), ${fel} fel. ${inv.pages.length} sidor, ${quizzar} quizzar.`);
}

// ---------------------------------------------------------------------------
// text
// ---------------------------------------------------------------------------

// Windows egen tar (bsdtar) läser zip-arkiv; GNU tar i Git Bash tolkar "C:" som en fjärrvärd.
const TAR = process.platform === "win32" ? "C:/Windows/System32/tar.exe" : "tar";

function unzipXmlText(file: string, pattern: string): string {
  const listing = lines(execFileSync(TAR, ["-tf", file], { encoding: "utf8" })).filter((n) => new RegExp(pattern).test(n));
  listing.sort((a, b) => Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0) - Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0));
  return listing
    .map((entry, i) => {
      const xml = execFileSync(TAR, ["-xOf", file, entry], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      const text = xml
        .replace(/<\/(w:p|a:p)>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      return pattern.includes("slide") ? `--- bild ${i + 1} ---\n${text}` : text;
    })
    .join("\n");
}

function cmdText(k: Kurs): void {
  const manifest = readManifest(k);
  let n = 0;
  for (const f of Object.values(manifest.filer)) {
    const src = join(k.dir, f.sokvag);
    const dst = join(k.dir, "text", f.sokvag.replace(/^filer[\\/]/, "")) + ".txt";
    if (existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) continue;
    const ext = extname(src).toLowerCase();
    try {
      let text: string | null = null;
      if (ext === ".pdf") {
        mkdirSync(dirname(dst), { recursive: true });
        execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", src, dst]);
        n++;
        continue;
      }
      if (ext === ".docx") text = unzipXmlText(src, "^word/document\\.xml$");
      if (ext === ".pptx") text = unzipXmlText(src, "^ppt/slides/slide\\d+\\.xml$");
      if (text !== null) {
        write(dst, text);
        n++;
      }
    } catch (e) {
      say(`  (kunde inte läsa ${f.namn}: ${e instanceof Error ? e.message : e})`);
    }
  }
  say(`Tog ut text ur ${n} filer till material/${k.key}/text/.`);
}

// ---------------------------------------------------------------------------
// quizkort: New Quizzes → utkastkort
// ---------------------------------------------------------------------------

type QuizItem = {
  position: number;
  entry: {
    item_body: string;
    interaction_type_slug: string;
    interaction_data?: { choices?: { id: string; position: number; item_body: string }[] };
    scoring_data?: { value?: unknown };
  };
};

const normal = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Skriver en kortfil per quiz med frågorna som utkast av typen Alternativ. Varianterna
 * "för studenter med speciella behov" hoppas över när frågan redan finns. Filerna flyttas
 * sedan in i rätt område (Claude eller admin) och granskas i admin innan de publiceras.
 */
function cmdQuizkort(k: Kurs): void {
  const dir = join(k.dir, "quizzar");
  if (!existsSync(dir)) throw new Error("Inga quizzar hämtade. Kör canvas hamta först.");
  const taken = new Set<string>();
  try {
    for (const area of loadCourse(ROOT, k.key).course.categories) for (const c of area.cards) taken.add(c.key);
  } catch {
    // Kursen finns inte i content/ ännu: nycklarna behöver bara vara unika sinsemellan.
  }
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    // Ordinarie quizzar före specialvarianterna, så att källan pekar på originalet.
    .sort((a, b) => Number(/speciella/i.test(a)) - Number(/speciella/i.test(b)) || a.localeCompare(b, "sv"));
  const seen = new Set<string>();
  let skipped = 0;
  let total = 0;
  for (const f of files) {
    const name = f.replace(/^\d+-/, "").replace(/\.json$/, "").replace(/\.$/, "");
    const items = (JSON.parse(readFileSync(join(dir, f), "utf8")) as QuizItem[]).sort((a, b) => a.position - b.position);
    const cards: ContentCard[] = [];
    for (const item of items) {
      const e = item.entry;
      const front = htmlTillText(e.item_body);
      const choices = [...(e.interaction_data?.choices ?? [])].sort((a, b) => a.position - b.position);
      const right = new Set(Array.isArray(e.scoring_data?.value) ? (e.scoring_data.value as string[]) : [e.scoring_data?.value as string]);
      if (!front || choices.length < 2 || !["multi-answer", "choice"].includes(e.interaction_type_slug)) {
        skipped++;
        continue;
      }
      if (seen.has(normal(front))) continue;
      seen.add(normal(front));
      // Canvas kan ha tomma alternativ (t.ex. när "<hkl>" tolkats som en tagg i quizredigeraren).
      // Ett tomt felalternativ stryks; saknas ett rätt alternativ går frågan inte att använda.
      const all = choices.map((c) => ({ text: htmlTillText(c.item_body).replace(/\n+/g, " ").trim(), correct: right.has(c.id) }));
      const options = all.filter((o) => o.text);
      if (all.some((o) => !o.text && o.correct) || options.length < 2) {
        skipped++;
        continue;
      }
      const correct = options.filter((o) => o.correct).map((o) => o.text);
      cards.push({
        key: uniqueKey(`quiz-${slugifyKey(front)}`, taken),
        // "(två rätta svar)" o.d. behövs inte: passet visar själv hur många alternativ som ska väljas.
        front: front
          .replace(/\n+/g, " ")
          .replace(/\s*\((?:ett|två|tre|fyra|[1-4]) rätta?(?: svar)?\)\s*/gi, " ")
          .trim(),
        back: correct.length === 1 ? `Rätt svar: ${correct[0]}` : `Rätta svar: ${correct.join("; ")}`,
        hint: null,
        active: false,
        kind: "alternativ",
        options,
        review: "utkast",
        source: `Canvas, ${name}, fråga ${item.position}`,
        original: false,
        flag: null,
      });
    }
    if (cards.length === 0) continue;
    total += cards.length;
    write(join(k.dir, "forslag", `quiz-${slugifyKey(name)}.md`), serializeCardFile({ title: name, cards }));
    say(`  ${name}: ${cards.length} frågor`);
  }
  say(`Skrev ${total} utkastkort till material/${k.key}/forslag/ (${skipped} frågor hoppades över: annan typ eller ofullständiga alternativ).`);
}

// ---------------------------------------------------------------------------

export async function runCanvas(positional: string[]): Promise<void> {
  const [, sub, key] = positional;
  const k = kurs(key);
  switch (sub) {
    case "inventera":
      return cmdInventera(k);
    case "hamta":
    case "hämta":
      return cmdHamta(k);
    case "text":
      return cmdText(k);
    case "quizkort":
      return cmdQuizkort(k);
    default:
      throw new Error("Använd: canvas inventera|hamta|text|quizkort <kurs>");
  }
}
