# BLOCKERS

## LÖST 2026-09-14: Docker Desktop installerat

Alvin installerade Docker Desktop (per-user, WSL 2) efter `wsl --install --no-distribution` och
omstart. `supabase start` fungerar, migrationer och seed körs vid start. Texten nedan är kvar som
historik.

## Docker saknas på utvecklingsmaskinen (2026-09-11)

Supabase CLI kräver Docker för `supabase start`. På den här maskinen finns varken Docker Desktop,
WSL eller en lokal Postgres, och Docker Desktop kan inte installeras utan administratörsrättigheter
och omstart. Jag har därför:

- Byggt hela projektet för Supabase CLI + Docker precis som specen säger (`supabase/config.toml`,
  migrationer, seed). `supabase start` + `npm run db:reset` ska fungera direkt på en maskin med
  Docker.
- Kört RLS-testerna mot en riktig Postgres i process (PGlite 0.5, Postgres 18) med samma
  migrationsfiler och en liten shim som återskapar Supabase-rollerna (`anon`, `authenticated`,
  `service_role`) och `auth.uid()`. Testerna kan även pekas mot en riktig Supabase-databas via
  `DATABASE_URL`.
- Verifierat gränssnittet manuellt i webbläsaren (375 px och desktop, ljust och mörkt) via en
  tillfällig sida som läste korten direkt från CSV-filerna. Sidan är borttagen.

**Konsekvens:** E2E-testerna (Playwright) är skrivna mot den riktiga stacken men har inte kunnat
exekveras. `npm run verify` (som inkluderar E2E) har därför inte varit grön här; `npm run
verify:unit` har varit grön före varje commit. Se SUMMARY.md för vad du bör köra först.

## Sidor som kräver databas kunde inte ses live

Startsidan, `/d/[slug]`, `/om` och allt under `/admin` hämtar data från Supabase och kunde bara
kontrolleras via typer, tester och den tillfälliga förhandsvisningen av komponenterna. Sidor utan
databasberoende (`/logga-in`, `/registrera`, `/integritet`, 403-sidan) är kontrollerade live.
