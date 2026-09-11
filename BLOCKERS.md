# BLOCKERS

## Docker saknas på utvecklingsmaskinen (2026-09-11)
Supabase CLI kräver Docker för `supabase start`. På den här maskinen finns varken Docker Desktop,
WSL eller en lokal Postgres, och Docker Desktop kan inte installeras utan administratörsrättigheter
och omstart. Jag har därför:

- Byggt hela projektet för Supabase CLI + Docker precis som specen säger (`supabase/config.toml`,
  migrationer, seed). `supabase start` ska fungera direkt på en maskin med Docker.
- Kört RLS-testerna mot en riktig Postgres i process (PGlite) med samma migrationsfiler och en
  liten shim som återskapar Supabase-rollerna (`anon`, `authenticated`) och `auth.uid()`.
  Testerna kan även pekas mot en riktig Supabase-databas via `DATABASE_URL`.
- E2E-testerna (Playwright) är skrivna mot den riktiga stacken och kräver att `supabase start`
  körs. De har inte kunnat exekveras här. Se SUMMARY.md för vad du bör köra först.
