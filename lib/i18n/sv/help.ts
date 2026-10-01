/** Hjälpsidan. Sätts ihop till sv i lib/i18n/sv.ts. */

export const help = {
  title: "Hjälp",
  lead: "Så använder du Kuggfri, från första passet till tentadagen. Svar på vanliga frågor finns längst ner.",
  tocLabel: "På den här sidan",
  sections: {
    start: "Kom igång",
    schedule: "Så fungerar schemat",
    modes: "Lägena",
    rating: "Skattningsskalan 1–5",
    keys: "Tangentbordsgenvägar",
    session: "Under passet",
    home: "Hemsidan och radardiagrammet",
    stats: "Min statistik",
    account: "Konto och data",
    faq: "Vanliga frågor",
    more: "Mer hjälp",
  },
  startSteps: [
    {
      title: "Skapa ett konto",
      body: "Namn, e-post och lösenord. Det tar en halv minut. Har du fått en kurslänk hamnar du direkt i kursen efteråt.",
    },
    {
      title: "Öppna dagens pass",
      body: "Hemsidan visar hur många kort som väntar i dag. ”Fortsätt plugga” tar dig till kursens sida.",
    },
    {
      title: "Välj läge",
      body: "På kursens sida väljer du hur du vill plugga. Schemalagd repetition är det vanliga valet, varje dag.",
    },
    {
      title: "Vänd och skatta",
      body: "Tänk ut svaret, vänd kortet och skatta ärligt från 1 till 5. Skattningen bestämmer när kortet kommer tillbaka.",
    },
  ],
  scheduleLead:
    "Kuggfri använder FSRS, en algoritm för spaced repetition. Du behöver inte planera något själv: schemat väljer vilka kort du ser varje dag.",
  schedulePoints: [
    {
      title: "Rätt kort på rätt dag",
      body: "Ett kort kommer tillbaka ungefär när du annars skulle ha börjat glömma det. Varje gång du kan det blir intervallet längre.",
    },
    {
      title: "Skatta ärligt",
      body: "Schemat lär sig av dina skattningar. För höga skattningar skjuter upp kort du inte kan, för låga ger repetitioner du inte behöver.",
    },
    {
      title: "Nya kort per dag",
      body: "Du får 20 nya kort per dag om du inte väljer 10 eller 40 under Pluggrytm på kontosidan. Kort som ska repeteras kommer alltid med, oavsett dagsmålet.",
    },
    {
      title: "Plugga så mycket du vill",
      body: "Dagens pass är golvet, inte taket. När det är klart kan du alltid välja Plugga vidare: först kommer korten som snart ska repeteras, sedan nya kort, utan gräns. Allt räknas in i schemat, precis som fri repetition, kluriga kort och duggor. Repeterar du ett kort innan det är dags växer intervallet lite mindre än om du väntat, och flera repetitioner samma dag ger inget längre intervall. Extra plugg är aldrig bortkastat, och schemat blir inte lurat.",
    },
    {
      title: "Tentadatumet",
      body: "Har kursen ett tentadatum planerar schemat mot det: alla kort introduceras i god tid, inget kort skjuts förbi tentan och de sista dagarna blir en slutrepetition av allt, svagast först. Ligger du efter höjs dagsmålet öppet, i ett ikappläge. Efter tentan fortsätter schemat långsiktigt.",
    },
    {
      title: "Streak och frysningar",
      body: "Streaken räknar dagar i rad med minst en repetition. Två frysningar täcker enstaka missade dagar, och du får en ny frysning var sjunde aktiva dag. Pluggar du helst vardagar kan du välja det under Konto, så räknas helger inte som missade.",
    },
  ],
  modesLead:
    "Du väljer läge på kursens sida. Under Inställningar i Ditt pass ställer du in passet för just det läget, till exempel hur många kort du vill ta. Valen sparas i webbläsaren till nästa gång. Alla lägen räknas: varje skattning uppdaterar kortets schema, oavsett läge. Schemalagd repetition ser till att du hinner det du behöver, och allt du pluggar utöver det gör de kommande passen lättare.",
  modes: {
    fsrs: "Nya och förfallna kort. Din skattning styr när kortet kommer tillbaka, och kort du skattar 1 eller 2 kommer igen senare i samma pass. Du kan ta färre kort än dagens, hoppa över nya kort och bara repetera, eller ta ett område i taget. När dagens pass är klart kan du plugga vidare så länge du vill.",
    tricky: "Bara kort du skattat 1 eller 2, och kort du aldrig sett. Ett kort du nu kan slutar räknas som klurigt. Du väljer antal, om de svåraste ska komma först och om osedda kort ska vara med.",
    free: "Bläddra fritt genom ett urval, hur många gånger du vill. Bra för att läsa in ett område. Du väljer antal, ordning (svagast först, kursens ordning eller slumpat) och om du vill ha vändkort, flerval eller båda.",
    random: "Hela kursen i slumpad ordning. Bra för att se att du kan korten utan att ordningen hjälper till. Du väljer antal och uppgiftstyper, och kan begränsa passet till de områden du kryssat i.",
    exam: "Innan duggan väljer du antal frågor (10, 20, 30 eller alla), om ledtrådar är tillåtna och om en timer ska visas. Efteråt ser du hur du ligger till.",
  },
  affectsSchedule: "Räknas i schemat",
  ratingLead:
    "Efter varje kort skattar du hur väl du kunde det, i alla lägen. Knapparna visar också när kortet kommer tillbaka (utom i duggan). Att ett kort kommer igen i samma pass gäller schemalagd repetition.",
  rating: {
    1: "Du kom inte på svaret. Kortet kommer igen i samma pass och snart därefter.",
    2: "Nära, men inte rätt. Räknas som en miss: kortet kommer igen i samma pass.",
    3: "Rätt, men det tog emot. Kortet kommer tillbaka ganska snart.",
    4: "Rätt efter en kort tanke. Vanligt intervall.",
    5: "Satt direkt. Längst intervall, och kortet räknas som inlärt.",
  } as Record<1 | 2 | 3 | 4 | 5, string>,
  ratingNote: "Kort med skattning 1 eller 2 hamnar bland dina kluriga kort tills du skattar dem högre.",
  keysLead: "På en dator med tangentbord går passet att sköta helt utan mus.",
  keys: {
    space: "Mellanslag",
    flip: "Vänd kortet",
    rate: "Skatta kortet",
    nav: "Föregående eller nästa kort",
    hint: "Visa ledtråd, om kortet har en",
    pick: "Välj svar på en flervalsfråga",
    answer: "Svara, och gå vidare efter svaret",
  },
  sessionLead: "Under skattningsknapparna finns en rad med små ikoner, och på själva kortet finns några till.",
  sessionTools: {
    info: { title: "Instruktioner", body: "Info-knappen visar hur passet fungerar." },
    sound: {
      title: "Ljud",
      body: "Högtalaren slår på eller stänger av ljudeffekterna. Samma knapp finns också på kortet.",
    },
    report: {
      title: "Rapportera fel",
      body: "Flaggan öppnar en rapport om kortet. Den går till kursens examinator.",
    },
    star: {
      title: "Stjärnmärk",
      body: "Stjärnan på kortet markerar det. Välj läget ”Stjärnmärkta” på kurssidan för att plugga bara dem, och se alla dina stjärnmärkta kort där.",
    },
  },
  homeBody:
    "Hemsidan visar dagens pass, din streak, din inlärda kunskap och tiden kvar till tentan. Genvägarna Kluriga kort och Dugga öppnar en ruta där du ser vad som ingår, väljer inställningar och startar direkt. Radardiagrammet visar hur mycket du kan inom varje område av kursen.",
  homeRadar:
    "Klicka på ett område i diagrammet eller i listan bredvid för att öppna det. Där pluggar du bara det området: schemalagt, som kluriga kort, fritt eller som dugga. Grönt betyder klart: Plugga området lyser grönt när dagens schemalagda kort i området är gjorda, och Kluriga kort när inga kluriga kort finns kvar.",
  statsBody:
    "Min statistik i menyn samlar din egen studiestatistik på ett ställe. Den bygger bara på dina egna repetitioner och syns bara för dig.",
  statsLink: "Öppna Min statistik",
  accountBody:
    "Under Konto byter du namn och lösenord, laddar ner allt vi har om dig och nollställer progress eller raderar kontot. Kuggfri skickar bara mejl som du själv begär, till exempel en inloggningslänk eller ett nytt lösenord.",
  accountLink: "Konto och inställningar",
  accountLinkMeta: "Namn, lösenord, dina data",
  privacyLink: "Integritetspolicy",
  privacyLinkMeta: "Vilka uppgifter som sparas och varför",
  faq: [
    {
      q: "Varför kom kortet tillbaka redan i dag?",
      a: "Skattar du ett kort 1 eller 2 läggs det sist i kön och kommer igen i samma pass. Nya kort och kort du nyss missat har korta intervall de första gångerna; intervallen växer när du kan kortet.",
    },
    {
      q: "Vad händer om jag missar en dag?",
      a: "Inget går förlorat. Korten väntar tills du kommer tillbaka, så nästa pass blir lite längre. Streaken skyddas av en frysning om du har någon kvar.",
    },
    {
      q: "Kan jag byta hur många nya kort jag får per dag?",
      a: "Ja. Gå till Konto och välj 10, 20 eller 40 under Pluggrytm. Förfallna kort kommer alltid med. Närmar sig tentan kan dagsmålet höjas i ikappläget, och då står det tydligt.",
    },
    {
      q: "Påverkar en dugga eller fri repetition schemat?",
      a: "Ja. Varje skattning räknas, i alla lägen: fri repetition, slumpad genomkörning, kluriga kort och duggor uppdaterar kortets schema precis som schemalagd repetition. Repeterar du ett kort innan det är dags växer intervallet lite mindre, och flera gånger samma dag ger inget längre intervall.",
    },
    {
      q: "Dagens pass är klart men jag vill plugga mer. Går det?",
      a: "Ja, alltid. Välj Plugga vidare på kursens sida eller i sammanfattningen efter passet. Du får 20 kort i taget: först de som snart ska repeteras, sedan nya kort utöver dagsmålet. Fortsätt så länge du vill, allt räknas in i schemat.",
    },
    {
      q: "Vad betyder ”Inlärda kort” och ”Inlärd kunskap”?",
      a: "Inlärda kort är kort vars senaste skattning är 5. Inlärd kunskap (”Kan nu” när du öppnar ett område) är schemats uppskattning av hur stor del av korten du minns just nu.",
    },
    {
      q: "Hittade ett fel i ett kort?",
      a: "Tryck på flaggan under skattningsknapparna och beskriv vad som är fel. Rapporten går till kursens examinator. Vill du ha svar kan du lämna din e-post, men det är frivilligt.",
    },
    {
      q: "Kan jag börja om?",
      a: "Ja. Under Konto nollställer du en kurs, bara schemat eller allt. Nollställer du bara schemat blir korten nya igen men dina skattningar sparas. Det går inte att ångra.",
    },
  ],
  moreBody:
    "Gäller det ett enskilt kort använder du flaggan under passet. Frågor om kursens innehåll går till examinatorn, allt annat till den som driver Kuggfri.",
  /** Länkblocket på Om-sidan. */
  fromAbout: "Så använder du Kuggfri",
  fromAboutMeta: "Kom igång, lägena, skattningsskalan och vanliga frågor.",
} as const;
