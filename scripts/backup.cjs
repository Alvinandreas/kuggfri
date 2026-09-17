/* eslint-disable @typescript-eslint/no-require-imports */
// Backup av produktionsdatabasen (Supabase-molnet) till backups/<datum-tid>/.
// Använder Supabase CLI:s lagrade projektuppgifter (från `supabase link`), så inget lösenord
// behövs i skriptet. CLI:t kör pg_dump i Docker, därför startas Docker Desktop vid behov.
//
//   node scripts/backup.cjs            tar en backup, behåller de 14 senaste
//   node scripts/backup.cjs --keep 30  behåller 30
//
// Återställning: se docs/BACKUP.md.
const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT_ROOT = path.join(ROOT, "backups");
const keepArg = process.argv.indexOf("--keep");
const KEEP = keepArg > -1 ? Number(process.argv[keepArg + 1]) : 14;
const DOCKER_EXE = path.join(process.env.LOCALAPPDATA || "", "Programs", "DockerDesktop", "Docker Desktop.exe");

function log(msg) {
  console.log(`[backup ${new Date().toISOString()}] ${msg}`);
}

function dockerUp() {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function ensureDocker() {
  if (dockerUp()) return;
  if (!fs.existsSync(DOCKER_EXE)) throw new Error(`Docker Desktop saknas: ${DOCKER_EXE}`);
  log("startar Docker Desktop…");
  spawn(DOCKER_EXE, [], { detached: true, stdio: "ignore" }).unref();
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    if (dockerUp()) {
      log("Docker är igång");
      return;
    }
  }
  throw new Error("Docker startade inte inom 5 minuter");
}

function dump(args, file, minBytes = 1000) {
  // Node 22 vägrar spawna .cmd utan shell; argumenten är egna, inga citattecken behövs.
  execFileSync("npx.cmd", ["supabase", "db", "dump", "--linked", ...args, "-f", file], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], shell: true });
  const size = fs.statSync(file).size;
  if (size < minBytes) throw new Error(`${path.basename(file)} blev bara ${size} byte`);
  return size;
}

function prune() {
  const dirs = fs
    .readdirSync(OUT_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}-\d{4}$/.test(d.name))
    .map((d) => d.name)
    .sort();
  for (const old of dirs.slice(0, Math.max(0, dirs.length - KEEP))) {
    fs.rmSync(path.join(OUT_ROOT, old), { recursive: true, force: true });
    log(`rensade ${old}`);
  }
}

(async () => {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const dir = path.join(OUT_ROOT, stamp);
  fs.mkdirSync(dir, { recursive: true });
  await ensureDocker();
  const schema = dump([], path.join(dir, "schema.sql"));
  const data = dump(["--data-only", "--use-copy"], path.join(dir, "data.sql"));
  const roles = dump(["--role-only"], path.join(dir, "roles.sql"), 100);
  fs.writeFileSync(path.join(dir, "INFO.txt"), `Kuggfri produktionsbackup ${new Date().toISOString()}\nschema.sql ${schema} B\ndata.sql ${data} B\nroles.sql ${roles} B\nÅterställning: docs/BACKUP.md\n`);
  log(`klart: ${dir} (schema ${schema} B, data ${data} B)`);
  prune();
})().catch((e) => {
  console.error(`[backup] MISSLYCKADES: ${e.message}`);
  process.exit(1);
});
