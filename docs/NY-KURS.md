# Lägga till en kurs

Vad som behövs för att en ny kurs ska fungera som Materialteknik, i den ordning det brukar göras.
Allt utom tentabanken och Canvasmaterialet ligger i git. Innehållspipelinen beskrivs i
[INNEHALL.md](INNEHALL.md), källkraven i [KALLKRITIK.md](KALLKRITIK.md), tentabanken i
[TENTOR.md](TENTOR.md).

## 1. Innehållet: `content/<kurs>/`

```bash
npm run kuggfri -- ny-kurs <kurs> --titel "Kursnamn" --kurskod ABC123
```

skapar `content/<kurs>/kurs.json` (opublicerad) och en första kortfil. Nyckeln `<kurs>` blir
mappnamnet, sluggen i `/d/<kurs>` och nyckeln överallt nedan; den byts inte i efterhand.

I `kurs.json` fylls i: `title`, `description`, `course_code`, `source_credit` (krediteringen som
visas på Om), `exam_date` (eller null; examinatorn kan också sätta det i admin), `published`,
`sort_order` och `categories` (ett område per kortfil, `ny-kategori` lägger till). Korten skrivs
enligt INNEHALL.md avsnitt 3, varje kort med källa enligt KALLKRITIK.md.

## 2. Konfigurationen: `lib/courses/<kurs>.ts`

Det som skiljer kursen från andra men inte är innehåll. Kopiera `lib/courses/materialteknik.ts`
och lägg till kursen i `ALL_COURSES` i `lib/courses/index.ts` (ordningen där är ordningen på Om
och Hjälp). Ett enhetstest (`tests/unit/courses`) kräver en konfiguration för varje kurs i
`content/`.

| Fält | Används till | Standard |
|---|---|---|
| `examiner` | Kontaktkortet på Om och Hjälp (namn, roll, e-post). Samma person för flera kurser visas en gång. | ingen |
| `examStart` | Klockslaget som nedräkningen till tentan på hemsidan siktar på. | 08.30 |
| `sourceHints` | Kursens egna dokumentnamn per källtyp (bokens filnamn, föreläsningsserier), som läggs till de generiska reglerna i `lib/cards/sources.ts`. Tipsen gäller alla kursers källor, så de ska vara kursens egna namn och inte vanliga ord. | inga |

## 3. Bilder: `public/kort/<kurs>/`

Bilder i korten skrivs `![alt-text](/kort/<kurs>/fil.svg)`. `kontrollera` kräver att sökvägen
börjar med `/kort/<kurs>/`, att filen finns och att alt-texten är beskrivande (se
`lib/content/images.ts`).

## 4. Canvas (valfritt): `"canvas"` i `kurs.json`

```json
"canvas": { "base": "https://chalmers.instructure.com", "courseId": 40969 }
```

Bara kurser med fältet får hämtas med `npm run kuggfri -- canvas inventera|hamta|text|quizkort <kurs>`
(Alvins TA-token i `.env.local`). Fältet hör till verktygen: det ingår inte i kurshashen, påverkar
inte `plan`/`apply`, och `pull` och de andra kommandona som skriver om `kurs.json` bevarar det.
Materialet hamnar i `material/<kurs>/`, som aldrig läggs i git.

## 5. Tentabanken: `material/<kurs>/tentor/`

Kursens tentor med facit, en fil per tenta, utanför git. Format och källkrav i TENTOR.md; synkas
med `npm run kuggfri -- tentor kontrollera|plan|apply <kurs> [--mal prod]`.

## 6. Examinator i appen

Kontaktkortet (punkt 2) är bara texten på Om och Hjälp. Behörigheten att redigera och granska
kursen ges i admin under deckets **Inställningar → Examinatorer** (tabellen `deck_examiners`, se
README). Innehåll som examinatorn ska godkänna går som utkast enligt KALLKRITIK.md.

## 7. Publicera

```bash
npm run kuggfri -- kontrollera <kurs>
npm run kuggfri -- plan <kurs> --mal prod
npm run kuggfri -- apply <kurs> --mal prod
npm run kuggfri -- seed            # så att lokal databas och E2E har kursen
```

Kursen syns för studenter först när `published` är `true` i `kurs.json` och planen är applicerad.

## Fortfarande låst till Materialteknik

- **Adminvyn** är medvetet låst till Materialteknik (`lib/admin/active-course.ts`,
  `ACTIVE_ADMIN_COURSE_SLUG`; Alvins beslut 30 sep 2026, DECISIONS.md). Sidomenyns adminposter och
  `/admin` leder alltid dit. En andra kurs går att lägga upp, synka och plugga i, men att
  administrera den i admin kräver att låsningen byts mot ett kursval (beskrivet i filen).
- **Källtipsen** gäller alla kurser samtidigt (källan på ett kort vet inte vilken kurs den hör
  till). Krockar två kursers tips behöver klassificeraren få kursen som argument.
- **Texter i `lib/i18n/`** är skrivna för Chalmers och en kurs i taget; de nämner inte kursen vid
  namn men förutsätter svenska och Chalmers tentaupplägg.
