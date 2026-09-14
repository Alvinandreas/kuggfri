# PLAN – Kuggfri

Vertikala skivor i byggordning. Varje skiva committas separat när `npm run verify` är grön
(se BLOCKERS.md för vad som inte kunnat köras på den här maskinen).

## Skiva 0 – Skelett och grund
- Next.js 15 (App Router), TypeScript strict, Tailwind v4, ESLint, Vitest, Playwright.
- Designsystem: färg-, typografi- och spacing-tokens i `app/globals.css`, ljust/mörkt läge
  som följer systemet med manuell override, `prefers-reduced-motion` respekteras.
- Alla UI-strängar i `lib/i18n/sv.ts`.
- Layout med sidfot, `noindex, nofollow`, `robots.txt` som blockerar allt.
- `npm run verify` = typecheck + lint + enhetstester + E2E.
- `.env.example`, `vercel.json`.
**Acceptans:** `npm run verify:unit` grön, startsidan renderar med rätt metadata.

## Skiva 1 – Datamodell och seed
- Supabase-projekt lokalt (`supabase/config.toml`), migrationer för alla tabeller, RLS-policyer,
  hjälpfunktioner (nollställning, radera konto, statistik).
- Seed byggd från de riktiga Brainscape-exporterna i `seed/materialteknik/` via
  `scripts/build-seed.ts` → `supabase/seed.sql`.
- Vitest-tester för samtliga RLS-policyer mot riktig Postgres (PGlite i process, samma SQL).
**Acceptans:** alla RLS-tester gröna; otillåten läsning/skrivning nekas i varje tabell.

## Skiva 2 – FSRS och progresslager
- `lib/fsrs/` ren modul utan React: mappning 1–5 → FSRS-grade, schemaläggning, vilka kort som är
  förfallna, sessionskö.
- `lib/progress/`: gemensam `CardProgress`-typ (identisk med `card_progress`), localStorage-lager,
  Supabase-lager, sammanslagning vid migrering (senaste `last_review` vinner).
**Acceptans:** enhetstester för FSRS-mappning, schemaläggning, att fri repetition inte muterar
progress, samt migreringslogiken.

## Skiva 3 – Studieläge (kärnan)
- `/d/[slug]`: deckets sida med val av läge (schemalagd, fri, slumpad), kategori/urval,
  nollställningsknappar med bekräftelsedialog.
- `/d/[slug]/plugga`: kortvy med flip, 1–5-skattning (knappar, tangenter, swipe),
  piltangenter/swipe för föregående/nästa, ledtråd, progressindikator, aria-live.
- Sessionssammanfattning.
- Gästläge: progress i localStorage, banner.
**Acceptans:** gäst kan plugga 10 kort, ladda om, progress kvar (E2E 1); fri repetition ändrar
inte nästa datum (E2E 4).

## Skiva 4 – Konton och synk
- Supabase Auth: e-post/lösenord samt magic link. Sidor `/logga-in`, `/registrera`, `/konto`.
- Migrering av lokal progress till kontot vid inloggning.
- Nollställning mot databasen, "ladda ner min data" (JSON), "radera mitt konto".
**Acceptans:** E2E 2 och 3 gröna.

## Skiva 5 – Admin
- `/admin` skyddad server-side (middleware + layout), 403 för icke-admin.
- CRUD för deck, kategorier, kort; live-förhandsvisning av markdown/KaTeX; drag-and-drop.
- Import från CSV/JSON med förhandsvisning och diff; export till JSON; publicera/avpublicera.
**Acceptans:** E2E 5 och 6 gröna; import-parsern har tester inkl. trasig indata.

## Skiva 6 – Statistik
- Per deck: unika användare, genomgångna kort, snittskattning per kort, lägst snitt.
**Acceptans:** admin ser statistiksidan med korrekta värden mot seedad data.

## Skiva 7 – Dokumentation och avslut
- `/om`, integritetspolicy, README (lokal start, riktigt Supabase-projekt, bli admin, import,
  Vercel), SUMMARY.md, DECISIONS.md kompletterad.
