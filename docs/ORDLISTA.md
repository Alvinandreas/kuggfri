# Ordlista

Koden, databasen och gränssnittet använder delvis olika ord för samma sak. Tabellnamnen är
engelska och äldre; gränssnittet och dokumentationen är svenska. Den här listan visar var du
hittar vad.

| I gränssnittet / dokumentationen | I databasen och koden | Förklaring |
|---|---|---|
| **kurs** (äldre: deck, kortlek) | `decks`, `deck_id`, katalogen `content/<kurs>/` | Den gemensamma behållaren för allt innehåll i en kurs. Nås via `/d/<slug>`; metadata i `content/<kurs>/kurs.json`. |
| **område** (äldre: kategori) | `categories`, `category_id` | Kursens ämnesindelning. En kortfil i `content/<kurs>/` per område ([INNEHALL.md](INNEHALL.md) 3.1). |
| **kort** / **uppgift** | `cards` | En fråga med svar. Varje kort har en **uppgiftstyp** (`cards.kind`, `lib/cards/kinds.ts`): självskattning, begrepp, sant-falskt eller alternativ. |
| **originalkort** | `cards.original` | Den beprövade uppsättningen (de 144 korten före 28 sep 2026) som studenter kan välja att plugga enbart. Arkiverade som de såg ut i `arkiv/originalkorten/`. |
| **utkast** | `cards.review_status = 'utkast'` (`status: utkast` i kortfilen) | Ett förslag som väntar på granskning. Aldrig aktivt, aldrig synligt för studenter. `avvisad` = avvisat förslag som ligger kvar. |
| **granskning** | fliken Granskning i admin | Där examinator eller admin godkänner, rättar eller avvisar utkast och åtgärdar flaggor ([INNEHALL-GRANSKNING.md](INNEHALL-GRANSKNING.md), [KALLKRITIK.md](KALLKRITIK.md)). |
| **flagga** | `cards.flag_note`, `flagged_at`, `flagged_by` (`flagga:` i kortfilen) | En anteckning om ett misstänkt fel som behöver åtgärdas. Flaggade kort samlas under Granskning → Flaggade. |
| **felrapport** | `card_reports` | En students rapport om att ett kort är fel; syns för examinatorn i admin. Inte samma sak som en flagga. |
| **examinator** | `deck_examiners`, `deck_examiner_invites`, `can_edit_deck()` | Får redigera och granska innehållet i sin egen kurs, men inte andras. |
| **utgåva** | `utgavor/<kurs>/*.json`, `kuggfri utgava/utgavor/aterga` | En sparad ögonblicksbild av kursens innehåll som man kan gå tillbaka till ([INNEHALL.md](INNEHALL.md) 3.3). |
| **kortversion** / historik | `card_versions` | Ett enskilt korts tidigare versioner; visas och återställs i admin. |
| **tentabanken** | `exams`, `material/<kurs>/tentor/` (utanför git) | Kursens gamla tentor med facit, synkade med `kuggfri tentor` ([TENTOR.md](TENTOR.md)). |
| **tentaläget** | `exam_attempts`, `decks.exam_mode_open` | Där studenter skriver en hel tenta ur tentabanken; låst tills examinatorn öppnar det. |
| **progress** | `card_progress`, `review_log` | Studentens FSRS-schema per kort och logg över skattningar. |
