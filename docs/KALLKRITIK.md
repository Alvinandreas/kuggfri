# Källkritik: så granskas innehållet i Kuggfri

Kuggfri används av hela årskursen inför tentan. Ett fel på ett kort lärs in av hundratals
studenter, så **inget innehåll publiceras utan att det har kontrollerats mot kursens eget
material och godkänts av en människa** (Alvin 28 sep 2026). Det här dokumentet är arbetsordningen
för alla som skriver eller ändrar kort, människa eller AI.

## De fyra stegen

1. **Skriv från källan, inte från minnet.** Varje nytt eller ändrat kort bygger på en konkret
   källa i kursmaterialet (föreläsningsbilder, föreläsningsanteckningar, bokkapitel, läsanvisning,
   tentor med svarsförslag, quiz med facit). Källan anges på kortet:
   `källa: Canvas, <filnamn utan filändelse>, s. <sida>` (flera källor avskiljs med `;`).
   Allmän kunskap räknas inte som källa. Det som inte går att belägga i materialet skrivs inte.
2. **Oberoende kontroll.** En andra granskare, som inte skrev kortet, läser den angivna källan och
   prövar varje påstående på kortet: framsida, varje svarsalternativ, facit och förklaring.
   Utfall per kort: *belagt*, *rättat* (med motivering) eller *struket* (kan inte beläggas,
   tvetydigt eller missvisande). Strukna kort loggas, de försvinner inte tyst.
3. **Utkast.** Allt som klarat steg 2 läggs in som `status: utkast`. Utkast syns aldrig för
   studenter, inte ens via API:t.
4. **Mänskligt godkännande.** Examinator eller admin godkänner i admin (fliken Granskning).
   Först då publiceras kortet.

## Särskilda regler

- **Rättelser av publicerade kort** görs på samma kort (samma nyckel, så studenternas progress
  finns kvar) men kortet blir `status: utkast`. Felet försvinner därmed direkt ur studievyn och
  rättelsen syns i granskningskön. `källa:` inleds med `Rättelse:` och en mening om vad som var fel.
- **Dubbletter** slås ihop: det bästa kortet behålls (och blir utkast om texten ändras), de
  andra inaktiveras (`aktiv: nej`). Progress på det behållna kortet påverkas inte.
- **Quizfrågor och gamla tentor** har också fel ibland (facit, översättningar). Deras facit
  kontrolleras mot föreläsningsmaterialet som vilken källa som helst.
- **Uppgifter från sammanfattningar eller analyser** (även AI-genererade) är aldrig källor i sig.
- **Tvetydighet är ett fel.** Ett Sant/Falskt-påstående ska vara entydigt sant eller falskt enligt
  kursmaterialet; ord som "alltid", "aldrig" och "bara" används bara när källan säger så.
  Distraktorer i Alternativ ska vara entydigt fel, inte "delvis rätt".
- **Kursens språkbruk.** Svenska termer som i föreläsningarna 2026; engelsk term inom parentes
  när den behövs för att känna igen den i litteraturen.

## Var materialet finns

`npm run kuggfri -- canvas hamta materialteknik` hämtar kursens Canvasmaterial till
`material/materialteknik/` (utanför git; materialet tillhör kursen). `canvas text` tar ut text
(en sida per sidbrytningstecken `\f` i `.txt`-filerna, så sidnummer kan räknas fram).
