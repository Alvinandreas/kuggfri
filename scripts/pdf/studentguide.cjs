/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Studentguiden: hur en student använder Kuggfri, från kurslänken till tentan. Bara studentens
 * funktioner, inget för admin eller examinatorer. Skickas med i utskicket när tjänsten öppnar.
 *
 *   npm run pdf -- studentguide
 *
 * Skärmbilderna tas med scripts/pdf/skarmbilder-studentguide.cjs (demostudenten Alex, lokalt).
 * Texterna följer appens egna (lib/i18n/sv/*) och hjälpsidan, så att guiden säger samma sak.
 */
const path = require("path");
const QRCode = require(path.resolve(__dirname, "../../node_modules/qrcode"));
const T = require("./tema.cjs");
const { btn, callout, dots, num } = T;

const DIR = path.join(T.ROOT, "docs/studentguide");
const LINK = "kuggfri.com/d/materialteknik";
const OPERATOR = "alvinan@chalmers.se";
const EXAMINER = { name: "Johan Ahlström", email: "johan.ahlstrom@chalmers.se" };

const h = () => T.header(DIR, { eyebrow: "Studentguide", meta: "Materialteknik MTT085" });
const f = (p, n) => T.footer(DIR, { left: `Frågor? ${OPERATOR}`, page: p, pages: n });
const img = (name) => `bilder/${name}.png`;
const title = (t, lead) => `<div><h2>${t}</h2>${lead ? `<p class="lead" style="margin-top:3pt">${lead}</p>` : ""}</div>`;
const rate = (n) => `<span class="rate rate-${n}">${n}</span>`;

function pages(qr) {
  return [
    // 1. Omslag och kom igång
    (p, n) => `${h()}
  <h1>Så pluggar du med Kuggfri</h1>
  <p class="lead">Kuggfri visar rätt kort på rätt dag, så att det du lär dig sitter kvar till tentan. Korten bygger på kursens eget material, har källa och granskas av kursens examinatorer. <strong>Gratis, utan reklam och utan spårning.</strong></p>
  ${T.tiles([
    ["Kort", "405", "frågor, begrepp och tentauppgifter", "green"],
    ["Områden", "14", "som följer kursens upplägg", "navy"],
    ["Nya kort per dag", "20", "plus de kort som ska repeteras", "teal"],
    ["Kostnad", "0 kr", "för alla, hela kursen", "violet"],
  ])}
  <h2>Kom igång på tre minuter</h2>
  ${T.steps([
    ["Öppna kurslänken", `Skanna QR-koden eller gå till <b>${LINK}</b>, i mobilen eller på datorn.`],
    ["Skapa konto", "Välj <b>Fortsätt med Google</b>, eller fyll i namn, e-post och lösenord. Kursen öppnas direkt."],
    ["Gör ditt första pass", "Tryck <b>Börja plugga</b> och sedan <b>Starta</b>. Första passet är 20 kort, några minuter."],
    ["Kom tillbaka varje dag", "Schemat väljer vilka kort du ska repetera. Ett pass om dagen räcker långt."],
  ])}
  <div class="row cols-2 start">
    <div class="card" style="display:grid;grid-template-columns:auto 1fr;gap:12pt;align-items:center">
      <div class="qr" style="width:32mm">${qr}</div>
      <div><h3>Kurslänken</h3><p style="font-weight:750;color:var(--accent);margin-bottom:5pt">${LINK}</p><p class="small muted">Skanna med mobilkameran. Dela gärna länken med en kursare: den som saknar konto skapar ett och hamnar direkt i kursen.</p></div>
    </div>
    ${callout("Lägg Kuggfri på hemskärmen", "green", dots([
      "<b>iPhone:</b> öppna länken i Safari, tryck på Dela och välj Lägg till på hemskärmen.",
      "<b>Android:</b> öppna länken i Chrome, tryck på menyn och välj Lägg till på startskärmen.",
      "Då öppnas Kuggfri som en app, utan adressfält.",
    ]))}
  </div>
  <h2>Varför det fungerar</h2>
  <div class="row cols-3">${[
    ["Plocka fram, läs inte om", "Att försöka minnas svaret innan du vänder kortet ger mer än att läsa om. Det är själva framplockningen som lär dig."],
    ["Utspritt över tid", "Repetition utspridd över dagar slår plugg i klump. Schemat sprider ut korten åt dig."],
    ["Tiden där den behövs", "Kort du kan dröjer länge, kort du inte kan kommer snart. Du lägger tiden på det du inte kan än."],
  ].map(([t, d], i) => `<div class="decision"><div class="head">${num(i + 1)}<h3 style="margin:0">${t}</h3></div><p>${d}</p></div>`).join("")}</div>
  ${f(p, n)}`,

    // 2. Hemsidan
    (p, n) => `${h()}
  ${title("Hemsidan", "Här landar du varje gång du loggar in. Allt du behöver för dagen finns på en skärm.")}
  <div class="shot"><img src="${img("hem")}" alt=""></div>
  ${T.legend([
    "<b>Hälsningen</b> säger hur många kort som väntar på dig i dag.",
    "<b>Streaken</b>: hur många dagar i rad du har pluggat.",
    "<b>Kursblocket</b>: din inlärda kunskap, hur många kort du har sett och fyra nyckeltal.",
    "<b>Fortsätt plugga</b> tar dig till kurssidan, där du startar dagens pass.",
    "<b>Kluriga kort</b> och <b>Dugga</b>: genvägar där du ser vad som ingår och startar direkt.",
    "<b>Kunskap per område</b>: hur mycket du kan i varje del av kursen. Klicka på ett område för att plugga just det.",
    "<b>Menyn</b>: Hem, Min statistik, Kurssidan och Tentaläget. Längst ner finns Hjälp och ditt konto.",
  ], true)}
  ${f(p, n)}`,

    // 3. Kurssidan och lägena
    (p, n) => `${h()}
  ${title("Kurssidan och lägena", "Här väljer du hur du vill plugga. Valen sparas till nästa gång, och varje skattning räknas i schemat, oavsett läge.")}
  <div class="split" style="grid-template-columns:1.75fr 1fr">
    <div class="shot"><img src="${img("kurssida")}" alt=""></div>
    ${T.legend([
      "<b>Välj läge</b>: sex sätt att plugga, se tabellen nedan.",
      "<b>Ditt urval</b>: hela kursen, eller de områden du kryssat i.",
      "<b>Inställningar</b> för passet: antal kort, nya kort och ett område i taget. De ändras efter läget.",
      "<b>Starta</b> passet. Under knappen står hur många kort det blir och ungefär hur lång tid det tar.",
      "<b>Områden</b>: kryssa i för att plugga just dem. Klicka på ett namn för att välja bara det.",
    ])}
  </div>
  <div class="card"><table class="t">
    <tr><th style="width:26%">Läge</th><th style="width:42%">Vad du får</th><th>Bra när</th></tr>
    <tr><td class="n">Schemalagd repetition</td><td>Nya och förfallna kort. Kort du skattar 1 eller 2 kommer igen i samma pass.</td><td class="muted">Varje dag. Det vanliga valet.</td></tr>
    <tr><td class="n">Kluriga kort</td><td>Kort du skattat 1 eller 2, och kort du inte sett än. Svagast först.</td><td class="muted">Du vill jobba på det som tar emot.</td></tr>
    <tr><td class="n">Fri repetition</td><td>Bläddra fritt genom ett urval, så många gånger du vill.</td><td class="muted">Du läser in ett nytt område.</td></tr>
    <tr><td class="n">Slumpad genomkörning</td><td>Hela kursen, eller dina områden, i slumpad ordning.</td><td class="muted">Du vill se att du kan korten utan att ordningen hjälper.</td></tr>
    <tr><td class="n">Dugga</td><td>10, 20, 30 eller alla frågor, med eller utan ledtrådar och timer.</td><td class="muted">Du vill testa dig som på tentan.</td></tr>
    <tr><td class="n">Stjärnmärkta</td><td>Korten du har markerat med stjärnan.</td><td class="muted">Du har sparat kort att återkomma till.</td></tr>
  </table></div>
  <div class="row cols-2 start">
    ${callout("Plugga ett område", "green", `<p class="small">Klicka på ett område i radardiagrammet eller listan på hemsidan. Där pluggar du bara det området: schemalagt, kluriga kort, fritt eller som dugga. <b>Grönt betyder klart</b> för i dag.</p>`)}
    ${callout("Dela kursen med en vän", "navy", `<p class="small">Längst ner på kurssidan kopierar du kurslänken eller visar en QR-kod. Den som saknar konto skapar ett på en halv minut och hamnar direkt i kursen.</p>`)}
  </div>
  ${f(p, n)}`,

    // 4. Passet och skattningen
    (p, n) => `${h()}
  ${title("Ett kort i taget", "Försök svara i huvudet först, vänd sedan kortet och skatta hur väl du kunde det. Det är själva framplockningen som gör att du minns.")}
  <div class="row start" style="grid-template-columns:1fr 1fr 1.25fr;gap:5mm">
    <div><div class="phone"><img src="${img("mobil-fram")}" alt=""></div><div class="phonecap">Framsidan. Tryck <b>Vänd kortet</b>.</div></div>
    <div><div class="phone"><img src="${img("mobil-bak")}" alt=""></div><div class="phonecap">Baksidan. Skatta 1 till 5.</div></div>
    <div style="display:grid;gap:3.5mm">
      <div class="card"><h3>Skattningsskalan</h3>
        <table class="t" style="margin-top:2pt">${[
          [1, "Inte alls", "Du kom inte på svaret. Kortet kommer igen i samma pass."],
          [2, "Nästan", "Nära, men inte rätt. Räknas som en miss."],
          [3, "Delvis", "Rätt, men det tog emot. Kommer tillbaka ganska snart."],
          [4, "Bra", "Rätt efter en kort tanke. Vanligt intervall."],
          [5, "Klockrent", "Satt direkt. Längst intervall, och kortet räknas som inlärt."],
        ].map(([r, name, d]) => `<tr><td style="width:1%;padding-right:7pt">${rate(r)}</td><td><b>${name}</b><br><span class="small muted">${d}</span></td></tr>`).join("")}</table>
      </div>
      ${callout("Skatta ärligt", "green", `<p class="small">Schemat lär sig av dina skattningar. För höga skjuter upp kort du inte kan; för låga ger repetitioner du inte behöver.</p>`)}
    </div>
  </div>
  <div class="row cols-3 start">
    ${callout("I mobilen", "navy", dots(["Tryck på kortet eller på Vänd kortet.", "Svep vänster för 1 och höger för 5."]))}
    ${callout("På datorn", "teal", dots(["<kbd>Mellanslag</kbd> vänder kortet.", "<kbd>1</kbd> till <kbd>5</kbd> skattar."]))}
    ${callout("Avbryt när du vill", "violet", dots(["Krysset uppe till vänster avslutar passet.", "Allt du hunnit skatta är sparat."]))}
  </div>
  <div class="row cols-2 start">
    ${callout("Ledtrådar", "green", `<p class="small">Vissa kort har en ledtråd. Tryck <b>Visa ledtråd</b> (eller <kbd>H</kbd>) om du kör fast, innan du vänder kortet.</p>`)}
    ${callout("Tappar du anslutningen", "navy", `<p class="small">Fortsätt plugga. Skattningarna väntar och skickas automatiskt när du är uppkopplad igen.</p>`)}
  </div>
  ${f(p, n)}`,

    // 5. Flervalsfrågor och verktygen
    (p, n) => `${h()}
  ${title("Flervalsfrågor rättas direkt", "Sant eller falskt och frågor med alternativ, som på tentan. Du väljer, trycker Svara och ser direkt vad som var rätt, med en förklaring.")}
  <div class="row cols-2 start">
    <div><div class="shot"><img src="${img("quiz-fore")}" alt=""></div><div class="phonecap">Före: välj alla rätta alternativ och tryck <b>Svara</b>.</div></div>
    <div><div class="shot crop" style="aspect-ratio:1864/1180"><img src="${img("quiz-efter")}" alt=""></div><div class="phonecap">Efter: rätt svar markerat, och förklaringen under.</div></div>
  </div>
  <div class="row cols-2 start">
    <div class="card"><h3>Fyra sorters kort</h3><table class="t">
      <tr><td class="n">Självskattning</td><td>Fråga och svar. Du vänder och skattar dig själv.</td></tr>
      <tr><td class="n">Förklara begreppet</td><td>Ett begrepp att förklara. Du vänder och skattar.</td></tr>
      <tr><td class="n">Sant eller falskt</td><td>Ett påstående. Rättas automatiskt.</td></tr>
      <tr><td class="n">Välj rätt alternativ</td><td>Ett eller flera rätta svar. Rättas automatiskt.</td></tr>
    </table><p class="tiny muted" style="margin-top:4pt">Flervalsfrågor du kan tre gånger i rad räknas som inlärda.</p></div>
    <div class="card"><h3>Verktygen under passet</h3><ul class="acts">
      <li>${btn("Stjärnan")}<span>Markerar kortet. Läget Stjärnmärkta pluggar bara dem.</span></li>
      <li>${btn("Flaggan")}<span>Rapportera fel på kortet. Rapporten går till kursens examinator.</span></li>
      <li>${btn("Info och ljud")}<span>Hur passet fungerar, och ljudet av eller på.</span></li>
    </ul></div>
  </div>
  <div class="card"><h3>Tangentbordet</h3><table class="keys">
    <tr><td class="k"><kbd>Mellanslag</kbd></td><td>Vänd kortet</td><td class="k" style="padding-left:8mm"><kbd>1</kbd> till <kbd>9</kbd></td><td>Välj svar på en flervalsfråga</td></tr>
    <tr><td class="k"><kbd>1</kbd> till <kbd>5</kbd></td><td>Skatta kortet</td><td class="k" style="padding-left:8mm"><kbd>Enter</kbd></td><td>Svara, och gå vidare efter svaret</td></tr>
    <tr><td class="k"><kbd>←</kbd> <kbd>→</kbd></td><td>Föregående och nästa kort</td><td class="k" style="padding-left:8mm"><kbd>H</kbd></td><td>Visa ledtråd, om kortet har en</td></tr>
  </table></div>
  <div class="row cols-2 start">
    ${callout("Dugga: testa dig som på tentan", "teal", dots([
      "Slumpade frågor ur hela kursen eller ett område, en i taget och utan att gå tillbaka.",
      "Välj 10, 20, 30 eller alla frågor, och om ledtrådar och tidtagning ska vara med.",
      "Efteråt ser du hur många du kunde bra eller direkt. Svaren räknas in i schemat.",
    ]))}
    ${callout("Kluriga kort: jobba på det svåra", "violet", dots([
      "Kort du skattat 1 eller 2, och kort du inte sett än, svagast först.",
      "Ett kort du nu kan slutar räknas som klurigt.",
      "Öppna ett område på hemsidan för att ta bara dess kluriga kort.",
    ]))}
  </div>
  ${f(p, n)}`,

    // 6. Schemat
    (p, n) => `${h()}
  ${title("Så fungerar schemat", "Kuggfri använder FSRS, en algoritm för spaced repetition. Du behöver inte planera något själv: schemat väljer vilka kort du ser varje dag.")}
  <div class="split" style="grid-template-columns:1fr 1fr">
    <div style="display:grid;gap:3mm">${[
      ["Rätt kort på rätt dag", "Ett kort kommer tillbaka ungefär när du annars skulle ha börjat glömma det. Varje gång du kan det blir intervallet längre."],
      ["Nya kort per dag", "20 nya kort per dag, eller 10 eller 40 om du väljer det under Konto. Kort som ska repeteras kommer alltid med."],
      ["Plugga så mycket du vill", "Dagens pass är golvet, inte taket. <b>Plugga vidare</b> ger 20 kort till: först de som snart ska repeteras, sedan nya. Allt räknas."],
      ["Missar du en dag", "Går inget förlorat. Korten väntar, så nästa pass blir lite längre."],
      ["Streak och frysningar", "Streaken räknar dagar i rad med minst en repetition. Två frysningar täcker enstaka missade dagar, och du får en ny var sjunde aktiva dag."],
    ].map(([t, d], i) => `<div class="decision"><div class="head">${num(i + 1)}<h3 style="margin:0">${t}</h3></div><p>${d}</p></div>`).join("")}</div>
    <div><div class="shot crop" style="aspect-ratio:1480/2000"><img src="${img("sammanfattning")}" alt=""></div><div class="phonecap">Efter passet: dina siffror, Plugga vidare och korten som behöver mest arbete.</div></div>
  </div>
  <div class="card"><h3>Efter passet</h3><table class="t">
    <tr><td class="n" style="width:28%">Dina siffror</td><td>Repetitioner i dag, dagar i rad och hur många kort du kan just nu.</td></tr>
    <tr><td class="n">Plugga vidare</td><td>20 kort till, eller bara nya kort utöver dagsmålet. Helt frivilligt.</td></tr>
    <tr><td class="n">Fördelningen</td><td>Hur du skattade korten i passet, från Inte alls till Klockrent.</td></tr>
    <tr><td class="n">Behöver mest arbete</td><td>Korten du skattade lägst, med område. Bra att titta på en gång till.</td></tr>
      </table></div>
  ${callout("När kursen har ett tentadatum", "teal", `<p class="small">Planerar schemat mot tentan: alla kort introduceras i god tid, inget kort skjuts förbi tentan, och de sista dagarna blir en slutrepetition av allt, svagast först. Ligger du efter höjs dagsmålet öppet, i ett ikappläge. Efter tentan fortsätter schemat långsiktigt.</p>`)}
  ${f(p, n)}`,

    // 7. Min statistik
    (p, n) => `${h()}
  ${title("Min statistik", "Din egen studiestatistik på ett ställe. Den bygger bara på dina repetitioner och syns bara för dig.")}
  <div class="shot crop" style="aspect-ratio:2560/1960"><img src="${img("statistik")}" alt=""></div>
  ${T.legend([
    "<b>Nyckeltalen</b>: dagar i rad, repetitioner, inlärda kort och inlärd kunskap.",
    "<b>Aktiviteten</b>: en ruta per dag, ju grönare desto mer pluggat. Bredvid dina rekord.",
    "<b>Utvecklingen</b>: hur sedda och inlärda kort växer, och repetitioner per dag eller vecka.",
  ], true)}
  <div class="row cols-2 start">
    <div class="card"><h3>Längre ner på sidan</h3>${dots([
      "<b>Din pluggrytm</b>: vilka veckodagar och tider på dygnet du pluggar mest.",
      "<b>Så skattar du</b>: fördelningen av dina skattningar och dina vändningar, kort från 1 eller 2 hela vägen till 5.",
      "<b>Starkast</b> och <b>Att jobba på</b>: dina bästa och svagaste områden.",
      "<b>Milstolpar</b> att låsa upp, från första kortet till Tusenklubben.",
    ])}</div>
    <div class="card"><h3>Vad siffrorna betyder</h3><table class="t">
      <tr><td class="n">Inlärda kort</td><td>Kort vars senaste skattning är 5.</td></tr>
      <tr><td class="n">Inlärd kunskap</td><td>Schemats uppskattning av hur stor del av kursen du minns just nu.</td></tr>
      <tr><td class="n">Snittskattning</td><td>Ditt snitt av 5, den senaste veckan.</td></tr>
      <tr><td class="n">Kluriga kort</td><td>Kort du skattat 1 eller 2, tills du skattar dem högre.</td></tr>
    </table></div>
  </div>
  ${f(p, n)}`,

    // 8. Tentaläget, konto och vanliga frågor
    (p, n) => `${h()}
  ${title("Tentaläget, ditt konto och vanliga frågor")}
  <div class="row cols-2 start">
    ${callout("Tentaläget", "navy", `<p class="small">Kursens gamla tentor, en hel tenta i taget, med samma skrivtid, poäng och hjälpmedel som på riktigt. Efteråt rättas flerval och räkneuppgifter automatiskt, du bedömer dina skrivuppgifter mot lösningsförslagen och får poäng, betyg och facit. <b>Tentaläget öppnar senare under kursen</b>; till dess visar menyn ett lås.</p>`)}
    ${callout("Ditt konto", "green", dots([
      "<b>Pluggrytm:</b> 10, 20 eller 40 nya kort per dag, och om bara vardagar ska räknas i din streak.",
      "<b>Färgtema:</b> ljust, mörkt eller som din enhet.",
      "<b>Nollställ</b> en kurs, bara schemat eller allt. <b>Ladda ner</b> dina data, eller <b>radera</b> kontot.",
    ]))}
  </div>
  <div class="card"><h3>Vanliga frågor</h3><table class="t">${[
    ["Varför kom kortet tillbaka redan i dag?", "Skattar du 1 eller 2 läggs kortet sist i kön och kommer igen i samma pass. Nya kort har korta intervall de första gångerna."],
    ["Påverkar en dugga eller fri repetition schemat?", "Ja. Varje skattning räknas, i alla lägen. Repeterar du ett kort innan det är dags växer intervallet lite mindre."],
    ["Dagens pass är klart men jag vill plugga mer?", "Välj Plugga vidare på kurssidan eller efter passet. Fortsätt så länge du vill, allt räknas."],
    ["Hittade du ett fel på ett kort?", "Tryck på flaggan under passet och beskriv felet. Rapporten går till kursens examinator."],
    ["Kan jag börja om?", "Ja, under Konto. Nollställer du bara schemat blir korten nya igen men dina skattningar sparas. Det går inte att ångra."],
    ["Vad sparas om mig?", "Bara ditt namn, din e-post och din studieprogress, inom EU. Ingen reklam, ingen spårning, och inga mejl du inte själv har bett om."],
  ].map(([q, a]) => `<tr><td class="n" style="width:36%">${q}</td><td>${a}</td></tr>`).join("")}</table></div>
  <div class="row cols-3 start">
    ${callout("Fel på ett kort", "teal", `<p class="small">Flaggan under passet. Den går direkt till examinatorn, med kortet bifogat.</p>`)}
    ${callout("Frågor om kursens innehåll", "navy", `<p class="small">Examinatorn ${EXAMINER.name}, <b>${EXAMINER.email}</b></p>`)}
    ${callout("Konto och teknik", "green", `<p class="small">Alvin, som driver Kuggfri: <b>${OPERATOR}</b></p>`)}
  </div>
  <div class="card"><h3>Fem tips för att få ut mest av Kuggfri</h3><ol class="legend two" style="margin-top:4pt">${[
    "<b>Lite varje dag</b> slår mycket ibland. Ett pass om dagen håller schemat i takt.",
    "<b>Skatta ärligt</b>, även när det svider. Det är så schemat hittar dina luckor.",
    "<b>Öppna ett område</b> på hemsidan när en föreläsning är färsk, och plugga just det.",
    "<b>Ta kluriga kort</b> en gång i veckan, så blir de svåra korten lätta.",
    "<b>Gör en dugga</b> inför tentan för att se att du kan korten i blandad ordning.",
  ].map((t, i) => `<li>${num(i + 1)}<span>${t}</span></li>`).join("")}</ol></div>
  <p class="small muted" style="text-align:center">Mer hjälp finns under <b>Hjälp</b> i menyn på kuggfri.com. Lycka till med pluggandet!</p>
  ${f(p, n)}`,
  ];
}

async function bygg(skrivUt) {
  const qr = await QRCode.toString(`https://${LINK}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1d1c19", light: "#00000000" } });
  await skrivUt({
    name: "studentguide",
    html: T.documentHtml({ htmlDir: DIR, title: "Studentguide Kuggfri", pages: pages(qr) }),
    htmlFile: path.join(DIR, "studentguide.html"),
    pdfFile: path.join(T.ROOT, "docs", "Studentguide.pdf"),
  });
}

module.exports = { bygg };
