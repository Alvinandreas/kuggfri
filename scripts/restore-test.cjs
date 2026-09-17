/* eslint-disable @typescript-eslint/no-require-imports */
// Verifierar att en backup går att återställa: startar en tom Postgres-container med samma
// Supabase-image som den lokala stacken, läser in schema.sql + data.sql och räknar rader.
//
//   node scripts/restore-test.cjs backups/2026-09-17-2210
//
// Rör aldrig den lokala Supabase-stacken eller molnet. Containern tas bort efteråt.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, "data.sql"))) {
  console.error("Ange en backupmapp med schema.sql och data.sql.");
  process.exit(2);
}
const NAME = "kuggfri-restore-test";
const TAB = String.fromCharCode(9);
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts });

function image() {
  const list = sh("docker", ["images", "--format", "{{.Repository}}:{{.Tag}}"]).split(/\r?\n/);
  const img = list.find((l) => l.startsWith("public.ecr.aws/supabase/postgres:") || l.startsWith("supabase/postgres:"));
  if (!img) throw new Error("Ingen supabase/postgres-image lokalt. Kör `npx supabase start` en gång först.");
  return img;
}

function psql(sql) {
  return sh("docker", ["exec", "-i", NAME, "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-At", "-c", sql]).trim();
}

/**
 * Behåll public.* helt. Av auth-schemat behålls bara users, reducerat till id och e-post: den råa
 * imagens auth-tabeller har inte samma kolumner som molnets (GoTrue migrerar dem vid start), och
 * övriga auth-tabeller (sessioner, audit-logg, tokens) är förbrukningsdata. I en riktig
 * återställning till ett Supabase-projekt läses hela data.sql in oförändrad.
 */
function filterData(sql) {
  const header = /^-- Data for Name: (\w+); Type: TABLE DATA; Schema: (\w+);/;
  const copyLine = /^COPY "auth"\."users" \(([^)]*)\) FROM stdin;$/;
  const out = [];
  let mode = "keep"; // keep | skip | users
  let idIdx = -1;
  let emailIdx = -1;
  for (const line of sql.split(/\r?\n/)) {
    const m = header.exec(line);
    if (m) mode = m[2] === "public" ? "keep" : m[2] === "auth" && m[1] === "users" ? "users" : "skip";
    if (mode === "skip") continue;
    if (mode === "users") {
      const c = copyLine.exec(line);
      if (c) {
        const cols = c[1].split(",").map((x) => x.trim().replace(/"/g, ""));
        idIdx = cols.indexOf("id");
        emailIdx = cols.indexOf("email");
        out.push('COPY "auth"."users" ("id", "email") FROM stdin;');
        continue;
      }
      if (idIdx >= 0 && line !== "\\." && line.trim() !== "" && !line.startsWith("--") && !line.startsWith("SET ") && !line.startsWith("ALTER ")) {
        const f = line.split(TAB);
        out.push(`${f[idIdx]}${TAB}${f[emailIdx]}`);
        continue;
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

function psqlFile(file) {
  const raw = fs.readFileSync(file, "utf8");
  // supabase_vault tillhandahålls av plattformen och finns inte i en rå image.
  const content = path.basename(file) === "data.sql" ? filterData(raw) : raw.replace(/^CREATE EXTENSION IF NOT EXISTS "supabase_vault".*$/m, "");
  // replica-läge stänger av alla triggers: imagens event-triggers (som annars installerar en trasig
  // pg_graphql vid första DDL), handle_new_user (som annars dubblerar profiler) och FK-kontroller.
  const input = "set session_replication_role = replica;\n" + content;
  sh("docker", ["exec", "-i", NAME, "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input, maxBuffer: 1024 * 1024 * 256 });
}

(async () => {
  try {
    sh("docker", ["rm", "-f", NAME]);
  } catch {
    /* fanns inte */
  }
  const img = image();
  console.log("image:", img);
  sh("docker", ["run", "-d", "--name", NAME, "-e", "POSTGRES_PASSWORD=postgres", img]);
  // Imagen startar om Postgres en gång efter sin init, så vänta tills servern svarat stabilt.
  let okInARow = 0;
  for (let i = 0; i < 90 && okInARow < 4; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      okInARow = psql("select 1") === "1" ? okInARow + 1 : 0;
    } catch {
      okInARow = 0;
    }
  }
  if (okInARow < 4) throw new Error("Postgres i testcontainern blev aldrig redo");
  console.log("läser schema.sql…");
  psqlFile(path.join(dir, "schema.sql"));
  console.log("läser data.sql…");
  psqlFile(path.join(dir, "data.sql"));
  const counts = psql(
    "select string_agg(t || '=' || n, ', ') from (select 'decks' t, count(*) n from public.decks union all select 'cards', count(*) from public.cards union all select 'card_progress', count(*) from public.card_progress union all select 'review_log', count(*) from public.review_log union all select 'invites', count(*) from public.deck_examiner_invites union all select 'users', count(*) from auth.users union all select 'policies', count(*) from pg_policies where schemaname = 'public') x",
  );
  console.log("återställt:", counts);
  const fns = psql("select proname from pg_proc where proname in ('can_edit_deck','deck_stats_overview','handle_new_user') order by 1");
  console.log("funktioner:", fns.replace(/\n/g, ", "));
  sh("docker", ["rm", "-f", NAME]);
  console.log("OK: backupen går att återställa.");
})().catch((e) => {
  console.error("MISSLYCKADES:", e.stderr || e.message);
  try {
    sh("docker", ["rm", "-f", NAME]);
  } catch {
    /* ignorera */
  }
  process.exit(1);
});
