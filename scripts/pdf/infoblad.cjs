/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Infobladet till kursansvariga och examinatorer: vad Kuggfri är, hur det fungerar och vad det
 * innebär för en kurs, med Materialteknik som exempel. Två A4-sidor i ljust tema.
 *
 *   npm run pdf -- infoblad
 *
 * Ersätter det gamla docs/infoblad-kuggfri.html (144 kort, gästläge), som beskrev en äldre version.
 * Siffrorna för Materialteknik är läget 2 okt 2026.
 */
const path = require("path");
const T = require("./tema.cjs");
const { callout, dots } = T;

const DIR = path.join(T.ROOT, "docs/infoblad");
const h = () => T.header(DIR, { eyebrow: "Infoblad för kursansvariga", meta: "Flashcards för kurser på Chalmers" });
const f = (p, n) => T.footer(DIR, { left: "Alvin Andreasson, alvinan@chalmers.se", page: p, pages: n });
const check = `<span style="display:inline-flex;width:12pt;height:12pt;border-radius:50%;background:var(--accent);color:var(--accent-fg);font-size:7.5pt;font-weight:800;align-items:center;justify-content:center;flex:none">✓</span>`;

/** Repetitionskurvan: täta repetitioner i början, sedan allt längre intervall. */
function spacing() {
  return `<svg class="chart" viewBox="0 0 300 130" role="img">
    <line x1="10" y1="110" x2="290" y2="110" stroke="var(--line-strong)"/>
    <text x="10" y="125" font-size="9" fill="var(--muted)">dag 0</text><text x="290" y="125" font-size="9" fill="var(--muted)" text-anchor="end">dag 30</text>
    <g fill="none" stroke="var(--chart-2)" stroke-width="2" stroke-dasharray="3.5 3">
      <path d="M10,110 C15,92 21,92 26,110"/><path d="M26,110 C33,88 40,88 47,110"/><path d="M47,110 C57,82 67,82 77,110"/>
    </g>
    <g fill="none" stroke="var(--chart-1)" stroke-width="2.4" stroke-linecap="round">
      <path d="M77,110 C93,62 112,62 128,110"/><path d="M128,110 C162,18 256,18 290,110"/>
    </g>
    ${[26, 47, 77, 128, 290].map((x, i) => `<circle cx="${x}" cy="110" r="3.4" fill="var(--${i < 3 ? "chart-2" : "chart-1"})" stroke="var(--page)" stroke-width="1.5"/>`).join("")}
  </svg>
  <div class="chart-legend"><span><span class="swatch" style="background:var(--chart-2)"></span>Skattning 1–2: kortet kommer snart tillbaka</span><span><span class="swatch" style="background:var(--chart-1)"></span>Skattning 4–5: allt längre intervall</span></div>`;
}

const PAGES = [
  (p, n) => `${h()}
  <h1>Studenterna pluggar redan med korten. Nu kan kursen äga dem.</h1>
  <p class="lead">Kuggfri är en fri flashcard-tjänst för kurser på Chalmers. Korten bygger på kursens eget material, har källa på varje kort och granskas av kursens examinatorer. <strong>Gratis, utan reklam och utan spårning, med data inom EU.</strong></p>
  ${T.tiles([
    ["Materialteknik", "405", "kort i 14 områden som följer kursen", "green"],
    ["Tidigare version", "196", "studenter över två årskullar", "navy"],
    ["Kostnad", "0 kr", "för studenter och för kursen", "teal"],
    ["Källor", "Varje kort", "kontrollerat mot kursens material", "violet"],
  ])}
  <div class="row cols-2 start">
    <div class="card"><h3>Vad Kuggfri är</h3><p class="small">Studenten öppnar kurslänken i mobilen eller på datorn, skapar ett konto med sin Chalmersadress och börjar plugga direkt. Bara de som står på kursens deltagarlista kommer in. Varje kort har en fråga och ett svar, eller är en flervalsfråga som rättas automatiskt, som på tentan.</p><p class="small">Schemat väljer vilka kort studenten ser varje dag. Innehållet ägs av kursen, redigeras i webbläsaren och kan exporteras när som helst.</p></div>
    <div class="card"><h3>Bakgrund</h3><p class="small">Korten sammanställdes av en student under kursen och spreds i klassen och vidare till nästa kull. Den tidigare plattformen var en kommersiell app där varje student behövde godkännas manuellt och innehållet låg på ett privat konto.</p><p class="small">Kuggfri byggdes för att ta bort de hindren och för att kursen ska kunna äga och granska innehållet.</p></div>
  </div>
  <div class="card"><h3>Så maximerar den algoritmiska repetitionen inlärningen</h3>
    <div class="split" style="grid-template-columns:1fr 1fr;margin-top:3pt">
      <div><p class="small">Efter varje kort skattar studenten sig själv, 1 till 5. Skattningen styr när kortet kommer tillbaka: kort man kan väntar länge, kort man inte kan kommer snart. Algoritmen (FSRS, öppen och väl beprövad) räknar ut intervallet per kort utifrån hur stabilt minnet är.</p><p class="small">Det bygger på två av de mest robusta resultaten i inlärningsforskningen: <b>framplockning</b> (att hämta svaret ur minnet ger mer än att läsa om) och <b>utspridd repetition</b> (repetition över dagar slår plugg i klump).</p></div>
      <div>${spacing()}</div>
    </div>
    <div style="margin-top:9pt">${T.steps([
      ["Svara först", "Studenten försöker svara innan baksidan visas. Själva framplockningen är inlärningen."],
      ["Skatta 1–5", "Ärlig självskattning. Låga skattningar ger täta repetitioner, höga ger långa."],
      ["Rätt kort, rätt dag", "Nästa pass innehåller bara det som är dags."],
      ["Mot tentan", "Med ett tentadatum hinner alla kort repeteras före tentan, med en slutrepetition sist."],
    ])}</div>
  </div>
  ${f(p, n)}`,

  (p, n) => `${h()}
  <div class="card"><h3>Jämfört med kommersiella flashcard-appar</h3>
    <table class="t"><tr><th style="width:22%"></th><th style="width:40%">Kuggfri</th><th>Kommersiella appar</th></tr>
    ${[
      ["Kostnad", "Gratis, för alla, hela kursen", "Gratisnivå med begränsningar, prenumeration för resten"],
      ["Åtkomst", "En kurslänk och ett konto på en halv minut", "Konto, ofta med manuellt godkännande per student"],
      ["Innehållet", "Ägs av kursen, redigeras i webbläsaren, kan exporteras", "Ligger hos leverantören, ofta på en privatpersons konto"],
      ["Kvalitet", "Källa på varje kort, granskat av examinatorn, felrapporter från studenterna", "Ingen granskning, rättelser går via leverantören"],
      ["Insyn för läraren", "Svåraste områdena, kluriga frågor och aktivitet, anonymt", "Ingen, eller bara i betalda lärarpaket"],
      ["Data", "Minimal insamling, inom EU, ingen reklam och ingen spårning", "Reklam och spårning i gratisversionen"],
    ].map(([a, b, c]) => `<tr><td class="n">${a}</td><td><span style="display:flex;gap:5pt;align-items:flex-start">${check}<span>${b}</span></span></td><td class="muted">${c}</td></tr>`).join("")}
    </table>
  </div>
  <div class="row cols-2 start">
    <div class="card"><h3>För examinatorn</h3>${dots([
      "<b>Granskning i webbläsaren</b>, ett kort i taget: godkänn, redigera, flagga eller ta ur rotation, med kortkommandon.",
      "<b>Kursöversikt</b> med de svåraste områdena, kluriga frågor och hur långt studenterna kommit. Allt anonymt, och visas först när minst fem studenter skattat.",
      "<b>Felrapporter</b> från studenterna med länk rakt in i kortet, och ett veckobrev på måndagar som går att stänga av.",
      "<b>Tentaläget</b>: kursens gamla tentor med skrivtid, poäng och facit, när examinatorn vill öppna det.",
      "<b>Svenska eller engelska</b> för hela tjänsten, också korten, för den som inte läser svenska.",
    ])}</div>
    <div class="card"><h3>För studenterna</h3>${dots([
      "<b>Kom igång på en minut</b> i mobilen, utan app att installera.",
      "<b>Plugga smartare:</b> tiden läggs på det man inte kan än, inte på det man redan kan.",
      "<b>Sex lägen:</b> schemalagd repetition, kluriga kort, fri repetition, slumpad genomkörning, dugga och stjärnmärkta.",
      "<b>Se sin egen kurva:</b> kunskap per område, dagar i rad och milstolpar.",
      "<b>Lika för alla:</b> gratis, tillgänglighetstestat, fungerar med tangentbord och skärmläsare, ljust och mörkt tema.",
    ])}</div>
  </div>
  <div class="row cols-3 start">
    ${callout("Vad det innebär", "green", `<p class="small">En länk på kurssidan i Canvas och en mening i första föreläsningen. Studenterna hittar materialet från dag ett i stället för via kompisar i vecka fyra.</p>`)}
    ${callout("Vad du bidrar med", "navy", `<p class="small">En genomgång av korten i granskningen, ungefär en minut per kort, och sedan så lite eller så mycket du vill: rätta kort, svara på felrapporter eller läsa veckobrevet.</p>`)}
    ${callout("Vad vi står för", "teal", `<p class="small">Drift, underhåll, källkontroll av korten och nya kort när kursen ändras. Allt innehåll är exporterbart och kursen kan ta det med sig.</p>`)}
  </div>
  ${callout("Vill du ha din kurs i Kuggfri?", "green", `<p class="small">Hör av dig till Alvin Andreasson, <b>alvinan@chalmers.se</b>. Materialteknik (MTT085) finns redan på <b>kuggfri.com</b>, och fler kurser läggs till på samma sätt, med examinatorns tillstånd.</p>`)}
  ${f(p, n)}`,
];

async function bygg(skrivUt) {
  await skrivUt({
    name: "infoblad",
    html: T.documentHtml({ htmlDir: DIR, title: "Infoblad Kuggfri", pages: PAGES }),
    htmlFile: path.join(DIR, "infoblad.html"),
    pdfFile: path.join(T.ROOT, "docs", "Infoblad.pdf"),
  });
}

module.exports = { bygg };
