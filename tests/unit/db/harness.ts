/**
 * Testharness för databasen.
 *
 * Standard: PGlite (riktig Postgres i process) med Supabase-shim + alla
 * migrationsfiler. Sätt DATABASE_URL för att i stället köra mot en riktig
 * Supabase-databas (t.ex. `supabase start`, port 54322); då antas migrationerna
 * redan vara körda.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type Row = Record<string, unknown>;

export interface RawDb {
  exec(sql: string): Promise<void>;
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Kör fn i en transaktion. Fel => rollback och felet kastas vidare. */
  transaction<T>(fn: (tx: Pick<RawDb, "exec" | "query">) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export type Identity =
  | { role: "anon" }
  | { role: "authenticated"; sub: string }
  | { role: "service_role" };

export interface ScopedDb {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}

const ROOT = join(__dirname, "..", "..", "..");

async function createPglite(): Promise<RawDb> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const wrap = (target: { exec: (s: string) => Promise<unknown>; query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }) => ({
    exec: async (sql: string) => {
      await target.exec(sql);
    },
    query: async <T extends Row>(sql: string, params?: unknown[]) => (await target.query(sql, params)).rows as T[],
  });
  const base = wrap(db);
  return {
    ...base,
    transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
    close: () => db.close(),
  };
}

async function createPg(url: string): Promise<RawDb> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  const base = {
    exec: async (sql: string) => {
      await client.query(sql);
    },
    query: async <T extends Row>(sql: string, params?: unknown[]) =>
      (await client.query(sql, params as never[])).rows as T[],
  };
  return {
    ...base,
    transaction: async (fn) => {
      await client.query("begin");
      try {
        const result = await fn(base);
        await client.query("commit");
        return result;
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    },
    close: () => client.end(),
  };
}

export async function createTestDb(options: { seed?: boolean } = {}): Promise<RawDb> {
  const url = process.env.DATABASE_URL;
  if (url) {
    return createPg(url);
  }
  const db = await createPglite();
  await db.exec(readFileSync(join(__dirname, "supabase-shim.sql"), "utf8"));
  const migrationsDir = join(ROOT, "supabase", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    await db.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  if (options.seed) {
    await db.exec(readFileSync(join(ROOT, "supabase", "seed.sql"), "utf8"));
  }
  return db;
}

function identitySql(identity: Identity): string {
  if (identity.role === "anon") {
    return `set local role anon; select set_config('request.jwt.claims', '{"role":"anon"}', true);`;
  }
  if (identity.role === "service_role") {
    return `set local role service_role; select set_config('request.jwt.claims', '{"role":"service_role"}', true);`;
  }
  const claims = JSON.stringify({ sub: identity.sub, role: "authenticated" });
  return `set local role authenticated; select set_config('request.jwt.claims', '${claims}', true);`;
}

/**
 * Returnerar ett db-handtag där varje anrop körs i en egen transaktion
 * som den angivna identiteten, precis som PostgREST gör per request.
 */
export function as(db: RawDb, identity: Identity): ScopedDb {
  const setup = identitySql(identity);
  return {
    query: (sql, params) =>
      db.transaction(async (tx) => {
        await tx.exec(setup);
        return tx.query(sql, params);
      }),
    exec: (sql) =>
      db.transaction(async (tx) => {
        await tx.exec(setup);
        await tx.exec(sql);
      }),
  };
}

export const user = (db: RawDb, sub: string): ScopedDb => as(db, { role: "authenticated", sub });
export const anon = (db: RawDb): ScopedDb => as(db, { role: "anon" });

/** Skapar en användare i auth.users (triggern skapar profilen). */
/**
 * Skapar en testanvändare. Adressen räknas som bekräftad om inget annat anges, eftersom
 * det är normalfallet; `confirmed: false` används för att testa att obekräftade konton
 * inte ärver examinatorsrätt.
 */
export async function createUser(
  db: RawDb,
  email: string,
  opts: { admin?: boolean; displayName?: string; confirmed?: boolean } = {},
): Promise<string> {
  const meta = JSON.stringify(opts.displayName ? { display_name: opts.displayName } : {});
  const confirmed = opts.confirmed ?? true;
  const rows = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values ($1, $2::jsonb, case when $3 then now() else null end) returning id`,
    [email, meta, confirmed],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Kunde inte skapa testanvändare");
  if (opts.admin) {
    await db.query(`update public.profiles set is_admin = true where id = $1`, [id]);
  }
  return id;
}

export async function expectDenied(promise: Promise<unknown>, pattern: RegExp = /permission denied|row-level security|violates|not authenticated|forbidden|42501/i): Promise<void> {
  let threw = false;
  try {
    await promise;
  } catch (e) {
    threw = true;
    const message = e instanceof Error ? e.message : String(e);
    if (!pattern.test(message)) {
      throw new Error(`Förväntade nekad åtkomst men fick annat fel: ${message}`);
    }
  }
  if (!threw) throw new Error("Förväntade att åtkomsten skulle nekas, men den gick igenom.");
}
