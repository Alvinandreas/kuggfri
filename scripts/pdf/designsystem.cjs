/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * docs/Designsystem.pdf: designsystemet för Kuggfris PDF:er, byggt med systemet det beskriver.
 * Grunder (principer, färger, typografi, sidmall), komponenter, hur vi skildrar statistik, en guide
 * per diagramtyp i ljust och mörkt tema, mörkt tema för hela PDF:er och hur en PDF återskapas.
 *
 *   npm run pdf -- designsystem
 *
 * Diagrammen visar exempeldata (en student efter 18 dagar), märkt som exempel i dokumentet.
 */
const path = require("path");
const T = require("./tema.cjs");
const { btn, dot, dots, callout, num } = T;

const DIR = path.join(T.ROOT, "docs/designsystem");
const META = "PDF:er från Kuggfri, version 1, oktober 2026";

// ---------------------------------------------------------------------------------------------
// Exempeldata
// ---------------------------------------------------------------------------------------------

const AREAS = [
  ["Materialgrupper och egenskaper", 11, 6, 24], ["Materialvalsprocessen", 7, 8, 27], ["Kristallstruktur", 8, 7, 28],
  ["Fasdiagram och mikrostruktur", 19, 10, 45], ["Styvhet och elastisk deformation", 9, 5, 21], ["Plasticitet, dislokationer och härdning", 6, 7, 24],
  ["Brott och utmattning", 9, 8, 30], ["Termiska egenskaper, diffusion och krypning", 8, 8, 29], ["Stål, värmebehandling och bearbetning", 13, 9, 36],
  ["Icke-järnmetaller", 5, 4, 17], ["Hållbarhet och återvinning", 7, 4, 16], ["Polymerers struktur", 15, 9, 37],
  ["Polymerers reologi och bearbetning", 20, 10, 44], ["Polymerers mekaniska egenskaper", 13, 6, 27],
].map(([label, learned, partial, total]) => ({ label, learned, partial, total }));

const DAYS = ["14 sep", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "1 okt"];
const REVIEWS = [20, 31, 41, 49, 47, 34, 35, 50, 56, 67, 65, 64, 42, 38, 70, 86, 91, 73];
const NEW = [20, 20, 20, 15, 25, 10, 12, 30, 20, 25, 20, 30, 9, 13, 20, 20, 25, 15];
const LEARNED = [0, 4, 9, 15, 22, 28, 33, 40, 48, 57, 66, 74, 80, 86, 97, 112, 131, 150];
const SEEN = NEW.reduce((acc, v) => [...acc, (acc[acc.length - 1] ?? 0) + v], []).map((v) => Math.min(v, 368));

/** Aktivitet per dag i tolv veckor: lugnare före kursstarten, sedan de 18 dagarna ovan. */
function activity() {
  const out = {};
  const end = new Date("2026-10-01T12:00:00Z");
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 84; i++) {
    const d = new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10);
    out[d] = i < REVIEWS.length ? REVIEWS[REVIEWS.length - 1 - i] : rnd() < 0.35 ? Math.round(rnd() * 25) : 0;
  }
  return out;
}

/** Spridning: andel inlärda mot snittskattning per kort; de kluriga korten markerade. */
function cards() {
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: 90 }, () => {
    const x = Math.min(0.98, Math.max(0.02, rnd() ** 0.8));
    const y = Math.min(4.9, Math.max(1.1, 1.3 + x * 3.2 + (rnd() - 0.5) * 1.4));
    return { x, y, mark: x < 0.3 && y < 2.3 };
  });
}

// ---------------------------------------------------------------------------------------------
// Byggstenar för den här PDF:en
// ---------------------------------------------------------------------------------------------

const h = () => T.header(DIR, { eyebrow: "Designsystem", meta: META });
const f = (p, n) => T.footer(DIR, { left: "Kuggfri, designsystemet för PDF:er", page: p, pages: n });

/** Samma diagram i ljust och mörkt tema, sida vid sida. */
const both = (render, { capL = "Ljust tema", capD = "Mörkt tema", style = "" } = {}) =>
  `<div class="row cols-2">${[["", capL], [" dark", capD]].map(([cls, cap]) => `<div class="panel${cls}" style="${style}"><div class="cap"><span>${cap}</span><span>Exempeldata</span></div>${render()}</div>`).join("")}</div>`;

/** En diagramguide: rubrik, när den används, proven och reglerna. */
const guide = ({ title, when, render, rules, fn, style }) => `
  <div><h2>${title}</h2><p class="small muted" style="margin-top:2pt">${when}</p></div>
  ${both(render, { style })}
  <div class="row start" style="grid-template-columns:1.6fr 1fr">${callout("Regler", "green", dots(rules))}<div class="callout"><h3>${dot("navy")}I koden</h3><p class="small"><code>${fn}</code> i <code>scripts/pdf/tema.cjs</code>.</p></div></div>`;

const swatch = (name, token) => `<div class="sw"><div class="c" style="background:var(--${token})"></div><div class="t"><b>${name}</b><span>${token}</span></div></div>`;

const COLORS = [
  ["Sida", "page"], ["Duk", "bg"], ["Block", "surface"], ["Yta 2", "surface-2"], ["Yta 3", "surface-3"], ["Linje", "line"],
  ["Text", "fg"], ["Dämpad", "muted"], ["Accent", "accent"], ["Accent mjuk", "accent-soft"], ["Accent text", "accent-ink"], ["Fara", "danger"],
];

// ---------------------------------------------------------------------------------------------
// Sidorna
// ---------------------------------------------------------------------------------------------

const TOC = [
  ["Grunder", "Principer, språk och tal", 2], ["", "Färger", 3], ["", "Typografi, sidmall och rutnät", 4],
  ["Komponenter", "Nyckeltal, steg, block och knappar", 5], ["", "Skärmbilder, listor och tabeller", 6],
  ["Statistik", "Så skildrar vi statistik", 7],
  ["Diagram", "Andelsstapel och framstegsstapel", 8], ["", "Stapeldiagram", 9], ["", "Linjediagram och ringdiagram", 10],
  ["", "Radardiagram", 11], ["", "Områdesstaplar och tabell med staplar", 12], ["", "Aktivitetskarta och skattningar", 13],
  ["", "Spridningsdiagram och diagrammet på sidan", 14],
  ["Teman", "Mörkt tema för PDF:er", 15], ["Arbetssätt", "Så återskapar du en PDF", 16],
];

const REVIEW_SEGMENTS = [{ label: "Granskade", tone: "chart-1" }, { label: "Att granska", tone: "chart-3", opacity: 0.7 }, { label: "Ur rotation", tone: "line-strong" }];

const PAGES = [
  // 1. Omslag
  (p, n) => `${h()}
  <h1>Designsystemet för Kuggfris PDF:er</h1>
  <p class="lead">Samma tokens, typsnitt och komponenter som kuggfri.com, anpassade för A4. Den här PDF:en är byggd med systemet den beskriver, och allt i den kan återskapas med ett kommando. <strong>Ljust tema är standard; mörkt tema finns för skärm.</strong></p>
  ${T.tiles([["Typsnitt", "Figtree", "självhostat, vikt 300 till 900", "green"], ["Teman", "2", "ljust för utskrift, mörkt för skärm", "navy"], ["Diagramtyper", "12", "med regler, ljust och mörkt", "teal"], ["Kommando", "1", "npm run pdf", "violet"]])}
  <div class="row start" style="grid-template-columns:1.25fr 1fr">
    <div class="card"><h3>Innehåll</h3>
      <table class="t">${TOC.map(([a, b, pg]) => `<tr><td class="n">${a}</td><td>${b}</td><td style="text-align:right;color:var(--muted)">${pg}</td></tr>`).join("")}</table>
    </div>
    <div style="display:grid;gap:3.5mm">
      ${callout("Varför ett eget system för PDF:er", "green", `<p class="small">Infoblad, granskningsguider och mötesunderlag ska kännas som tjänsten själv. Webbens designsystem (kuggfri.com/designsystem) gäller skärmen; det här översätter det till papper: millimeter i stället för pixlar, vit sida i stället för duk, och diagram som fungerar utan hovring.</p>`)}
      ${callout("Var allt finns", "navy", dots([
        "Tema, komponenter och diagram: <code>scripts/pdf/tema.cjs</code>",
        "Utskrift med kontroller: <code>scripts/pdf/skriv-ut.cjs</code>",
        "Dokumenten: <code>scripts/pdf/</code>, resultatet i <code>docs/</code>",
        "Webbens tokens: <code>app/globals.css</code>",
      ]))}
      <div class="card"><h3>Byggda med systemet</h3><table class="t">
        <tr><td class="n">Designsystem.pdf</td><td class="muted small" style="white-space:nowrap">Det här dokumentet</td></tr>
        <tr><td class="n">granskningsguide-sv.pdf</td><td class="muted small" style="white-space:nowrap">Johan, områdena 1–11</td></tr>
        <tr><td class="n">review-guide-en.pdf</td><td class="muted small" style="white-space:nowrap">Roland, topics 12–14</td></tr>
      </table></div>
    </div>
  </div>
  ${f(p, n)}`,

  // 2. Principer, språk och tal
  (p, n) => `${h()}
  <div><h2>Principer</h2><p class="lead" style="margin-top:3pt">Sex regler som avgör de flesta beslut. Är du osäker: välj det lugnare alternativet.</p></div>
  <div class="row cols-2">${[
    ["Lugnt och ljust", "Vit sida, grå ytor och svart text. Färg används där den betyder något: accenten för huvudhandlingen, diagramfärgerna för data."],
    ["Färg som prick, inte block", "Nyckeltal och rubriker får en liten färgprick. Inga färgade bakgrunder: de konkurrerar med innehållet och följer inte appen."],
    ["Samma språk som appen", "Tokens, Figtree, piller och rundade block från kuggfri.com. En PDF ska kännas som tjänsten på papper."],
    ["Läsaren först", "Skriv för den som läser: rubriker säger vad läsaren gör, ingen processtext. Engelska där läsaren inte läser svenska."],
    ["Riktiga bilder", "Skärmbilder tas från testkopian, som rätt roll ser den, med numrerade markeringar och en förklaringslista bredvid."],
    ["Inget rinner över", "Varje sida kontrolleras automatiskt vid bygget, och varje sida granskas som bild innan PDF:en skickas."],
  ].map(([t, d], i) => `<div class="decision"><div class="head">${num(i + 1)}<h3 style="margin:0">${t}</h3></div><p>${d}</p></div>`).join("")}</div>
  <h2>Språk och tal</h2>
  <div class="card"><table class="t">
    <tr><th style="width:20%">Vad</th><th style="width:22%">Svenska</th><th style="width:22%">Engelska</th><th>Regel</th></tr>
    <tr><td class="n">Procent</td><td>37 %</td><td>37%</td><td>Heltal. Nämnaren i undertexten: "150 av 405".</td></tr>
    <tr><td class="n">Decimaler</td><td>3,5</td><td>3.5</td><td>En decimal räcker nästan alltid.</td></tr>
    <tr><td class="n">Tusental</td><td>1 250</td><td>1,250</td><td>Mellanslag på svenska.</td></tr>
    <tr><td class="n">Intervall</td><td>områdena 1–11</td><td>topics 12–14</td><td>Tankstreck, inte bindestreck.</td></tr>
    <tr><td class="n">Datum</td><td>1 okt 2026</td><td>1 Oct 2026</td><td>Veckodag bara när den behövs.</td></tr>
    <tr><td class="n">Tid</td><td>ca 5 h, kl. 10.00</td><td>about 2 h, 10:00</td><td>Ungefärligt anges som ungefärligt.</td></tr>
    <tr><td class="n">Skiljetecken</td><td colspan="2">Komma eller tankstreck</td><td><b>Aldrig mittpunkten</b> (U+00B7), någonstans, i någon PDF. Bygget stoppar om den finns.</td></tr>
  </table></div>
  ${callout("Ton", "teal", dots([
    "Kort och sakligt, vänligt utan att vara käckt. Inga utropstecken.",
    "Säg vad läsaren ska göra, i den ordning hen gör det. Knappar och flikar heter exakt som i appen, i fetstil.",
    "Siffror i nyckeltal och tabeller avrundas och förklaras: vad räknas, och av hur många.",
  ]))}
  ${f(p, n)}`,

  // 3. Färger
  (p, n) => `${h()}
  <div><h2>Färger</h2><p class="lead" style="margin-top:3pt">Samma tokens som <code>app/globals.css</code>. Ytorna går i nivåer, från sidan till yta 3; mörkt tema skiljer dem åt med ljushet i stället för linjer.</p></div>
  <div class="panel"><div class="cap"><span>Ljust tema</span><span>Standard för PDF</span></div><div class="swatches">${COLORS.map(([a, b]) => swatch(a, b)).join("")}</div></div>
  <div class="panel dark"><div class="cap"><span>Mörkt tema</span><span>För skärm</span></div><div class="swatches">${COLORS.map(([a, b]) => swatch(a, b)).join("")}</div></div>
  <div class="row cols-2">${[["", "Diagramfärger, ljust"], [" dark", "Diagramfärger, mörkt"]].map(([cls, cap]) => `<div class="panel${cls}"><div class="cap"><span>${cap}</span><span>I den här ordningen</span></div><div class="swatches" style="grid-template-columns:repeat(5,1fr)">${[["Serie 1", "chart-1"], ["Serie 2", "chart-2"], ["Serie 3", "chart-3"], ["Serie 4", "chart-4"], ["Rutnät", "chart-grid"]].map(([a, b]) => swatch(a, b)).join("")}</div></div>`).join("")}</div>
  <div class="row cols-2">
    <div class="card"><h3>Skattningsskalan 1 till 5</h3><p class="small muted">Bara för skattningar. Dämpade toner från rött till grönt.</p>
      <div style="display:flex;gap:4pt;margin-top:5pt">${[1, 2, 3, 4, 5].map((i) => `<div style="flex:1;text-align:center"><div style="height:9mm;border-radius:8pt;background:var(--rate-${i})"></div><div class="tiny muted" style="margin-top:2pt">${i}</div></div>`).join("")}</div>
      <div class="dark" style="display:flex;gap:4pt;margin-top:5pt;background:var(--bg);padding:5pt;border-radius:9pt">${[1, 2, 3, 4, 5].map((i) => `<div style="flex:1;height:6mm;border-radius:7pt;background:var(--rate-${i})"></div>`).join("")}</div>
    </div>
    <div class="card"><h3>Områdesfärger</h3><p class="small muted">Varje område har en fast färg och ett nummer, samma i radar, lista och staplar. Efter tio börjar färgerna om.</p>
      <div style="display:flex;gap:3pt;margin-top:5pt;flex-wrap:wrap">${Array.from({ length: 10 }, (_, i) => `<span style="width:15pt;height:15pt;border-radius:50%;background:${T.tagVar(i)};display:inline-flex;align-items:center;justify-content:center;font-size:7pt;font-weight:700">${i + 1}</span>`).join("")}</div>
      <div class="dark" style="display:flex;gap:3pt;margin-top:5pt;flex-wrap:wrap;background:var(--bg);padding:5pt;border-radius:9pt">${Array.from({ length: 10 }, (_, i) => `<span style="width:15pt;height:15pt;border-radius:50%;background:${T.tagVar(i)};display:inline-flex;align-items:center;justify-content:center;font-size:7pt;font-weight:700;color:var(--fg)">${i + 1}</span>`).join("")}</div>
    </div>
  </div>
  ${f(p, n)}`,

  // 4. Typografi, sidmall och rutnät
  (p, n) => `${h()}
  <div><h2>Typografi</h2><p class="lead" style="margin-top:3pt">Figtree, självhostad från <code>@fontsource-variable/figtree</code>. Siffror är tabulära överallt, så att kolumner och nyckeltal står i linje.</p></div>
  <div class="card"><table class="t">
    <tr><th style="width:21%">Stil</th><th style="width:22%">Mått</th><th>Prov</th></tr>
    <tr><td class="n">Rubrik 1</td><td>25 pt, 800, −2 %</td><td><span style="font-size:22pt;font-weight:800;letter-spacing:-0.02em;line-height:1">Så granskar du korten</span></td></tr>
    <tr><td class="n">Nyckeltal</td><td>21 pt, 800</td><td><span style="font-size:21pt;font-weight:800;letter-spacing:-0.02em;line-height:1">297</span></td></tr>
    <tr><td class="n">Rubrik 2</td><td>14,5 pt, 800</td><td><span style="font-size:14.5pt;font-weight:800">Ett kort i taget</span></td></tr>
    <tr><td class="n">Ingress</td><td>11,2 pt, dämpad</td><td><span class="lead">Kortet visas som studenten ser det.</span></td></tr>
    <tr><td class="n">Rubrik 3</td><td>10,6 pt, 750</td><td><span style="font-size:10.6pt;font-weight:750">Bra att veta</span></td></tr>
    <tr><td class="n">Brödtext</td><td>9,6 pt, 1,45</td><td>Varje beslut sparas direkt och tar dig till nästa kort.</td></tr>
    <tr><td class="n">Liten text</td><td>8,8 pt</td><td class="small">Förklaringar, listor och tabeller.</td></tr>
    <tr><td class="n">Överrubrik</td><td>7,6 pt, 800, versaler</td><td><span class="eyebrow">Granskningsguide för examinatorer</span></td></tr>
  </table></div>
  <div class="split" style="grid-template-columns:0.8fr 1fr">
    <div class="panel" style="padding:8pt">${pageAnatomy()}</div>
    <div style="display:grid;gap:3.5mm">
      <div><h2>Sidmall</h2><p class="small muted" style="margin-top:2pt">A4 stående, utan utskriftsmarginal: marginalerna ligger i sidan själv. Sidan har fast höjd; det som inte får plats flyttas eller kortas.</p></div>
      ${T.legend([
        "<b>Marginaler</b> 13 mm upptill, 14 mm i sidorna och 10 mm nedtill.",
        "<b>Sidhuvud</b>: logotypen 11 mm hög till vänster; överrubrik i grönt och en metarad till höger.",
        "<b>Innehållet</b> i en kolumn med 4,2 mm mellan blocken.",
        "<b>Sidfot</b> nederst med en linje ovanför: liten logotyp, kontakt, kuggfri.com och sidnumret.",
      ])}
      <div class="card"><h3>Rutnät</h3><p class="tiny muted" style="margin-bottom:5pt">3,5 mm mellanrum. Bild och förklaring delas 1,15 till 1.</p>
        ${[[4, "Nyckeltal, steg"], [3, "Block"], [2, "Regler, jämförelser"]].map(([c, t]) => `<div style="display:grid;grid-template-columns:repeat(${c},1fr);gap:3pt;margin-bottom:4pt">${Array.from({ length: c }, () => `<div style="height:5mm;border-radius:4pt;background:var(--surface-2)"></div>`).join("")}</div><div class="tiny muted" style="margin:-1pt 0 4pt">${c} kolumner: ${t}</div>`).join("")}
        <div style="display:grid;grid-template-columns:1.15fr 1fr;gap:3pt"><div style="height:5mm;border-radius:4pt;background:var(--surface-3)"></div><div style="height:5mm;border-radius:4pt;background:var(--surface-2)"></div></div><div class="tiny muted" style="margin-top:3pt">Bild och förklaring</div>
      </div>
    </div>
  </div>
  ${f(p, n)}`,

  // 5. Komponenter 1
  (p, n) => `${h()}
  <div><h2>Nyckeltal</h2><p class="small muted" style="margin-top:2pt">Som <code>StatTile</code> på hemsidan: grå yta, färgprick och rubrik, stort värde och vad värdet betyder. Tre eller fyra i rad, överst, före diagrammen. Prickarnas ordning: grön, blå, orange, lila. I koden: <code>tiles([[rubrik, värde, undertext, färg]])</code>.</p></div>
  ${T.tiles([["Inlärda kort", "150", "37 % av 405", "green"], ["Dagar i rad", "18", "2 frysningar kvar", "navy"], ["Repetitioner i dag", "0", "28 kvar i dag", "teal"], ["Snittskattning", "3,5", "av 5, senaste veckan", "violet"]])}
  <div class="panel dark" style="padding:7pt 9pt">${T.tiles([["Inlärda kort", "150", "37 % av 405", "green"], ["Dagar i rad", "18", "2 frysningar kvar", "navy"], ["Repetitioner i dag", "0", "28 kvar i dag", "teal"], ["Snittskattning", "3,5", "av 5, senaste veckan", "violet"]])}</div>
  <div><h2>Steg</h2><p class="small muted" style="margin-top:2pt">Numrerade i accentens grönt, med en rubrik som är en handling och två till fyra rader text.</p></div>
  ${T.steps([["Öppna länken", "Öppna länken från Alvin i webbläsaren."], ["Skapa konto", "Välj Skapa konto och bekräfta via mejlet."], ["Öppna Granskning", "Välj Granskning i sidomenyn."], ["Börja", "Välj område och tryck Börja granska."]])}
  <div><h2>Block</h2><p class="small muted" style="margin-top:2pt">Tre sorter. Vitt block med kant för det man läser i lugn och ro, grå yta för det som kompletterar, och beslutsrutor för val.</p></div>
  <div class="row cols-3 start">
    <div class="card"><h3>Block</h3><p class="small">Vit yta, tunn kant och en mjuk skugga, 20 pt hörn. För tabeller, listor och skärmbilder.</p></div>
    ${callout("Grå ruta", "green", `<p class="small">Yta 2 utan kant, 12 pt hörn. Rubriken får en färgprick. För tips och sammanfattningar.</p>`)}
    <div class="decision"><div class="head">${btn("✓ Godkänn", "G", "primary")}</div><p>Beslutsruta: knappen som den ser ut i appen, och vad den gör.</p></div>
  </div>
  <div><h2>Knappar och tangenter</h2><p class="small muted" style="margin-top:2pt">Allt är piller, som i appen. En grön huvudhandling; resten grå eller kantade. Kortkommandon i en liten ram.</p></div>
  <div class="card" style="display:flex;flex-wrap:wrap;gap:8pt;align-items:center">${btn("✓ Godkänn", "G", "primary")}${btn("Redigera", "R")}${btn("Åtgärdad", "", "outline")}${btn("Ta ur rotation", "T")}<span class="small">Tangenter: <kbd>J</kbd> <kbd>K</kbd> <kbd>Esc</kbd> <kbd>Ctrl</kbd> <kbd>Z</kbd></span></div>
  ${f(p, n)}`,

  // 6. Komponenter 2
  (p, n) => `${h()}
  <div><h2>Skärmbilder med markeringar</h2><p class="small muted" style="margin-top:2pt">Skärmbilden i ett block med 12 pt hörn och kant. Gröna, numrerade markeringar på det som förklaras, och en numrerad förklaringslista under eller bredvid. Beskär till det som förklaras.</p></div>
  <div class="split" style="grid-template-columns:1.35fr 1fr">
    <div class="shot crop" style="aspect-ratio:2560/1085"><img src="${T.asset(DIR, "docs/granskningsguide/bilder/sv-fonster.png")}" alt=""></div>
    ${T.legend(["<b>Fetstil</b> för det som står i appen.", "Förklaringen säger vad det är och vad man gör med det.", "Numren följer läsordningen, uppifrån och ner.", "Markeringen ligger i marginalen, inte över text."])}
  </div>
  ${callout("Så tas skärmbilderna", "navy", dots([
    "Som den roll som ska läsa: en examinator ser inte adminens menyer. Skriptet loggar in med ett lokalt testkonto.",
    "Ljust läge, 2x upplösning och 1280 punkter brett fönster; mörkt läge bara till mörka PDF:er.",
    "Hela kort tas i ett högt fönster med hopfälld sidomeny, och klipps ut ur fönstret, inte ur hela sidan: helsidesläget ändrar höjden och flyttar fasta knapprader.",
    "Markeringarna läggs in i sidan före bilden, 28 punkter stora, i marginalen eller bredvid det de pekar på.",
    "Inga riktiga studentuppgifter i bild; testkopians demodata räcker.",
  ]))}
  <div class="row cols-2 start">
    <div class="card"><h3>Punktlista</h3>${dots(["Grön prick, 9 pt text.", "En mening per punkt, högst fem punkter.", "Röd prick för det man inte ska göra."])}</div>
    <div class="card"><h3>Åtgärdslista</h3><ul class="acts"><li>${btn("✓ Godkänn och ta bort flaggan", "G", "primary")}<span>Knappen överst, förklaringen under.</span></li><li>${btn("Åtgärdad", "", "outline")}<span>En linje mellan raderna.</span></li></ul></div>
  </div>
  <div class="card"><h3>Tabell</h3>
    <table class="t"><tr><th>Område</th><th>Kort</th><th>Flaggade</th><th>Granskare</th></tr>
      <tr><td class="n">1–11, metallerna</td><td>297</td><td>87</td><td>Johan</td></tr>
      <tr><td class="n">12–14, polymererna</td><td>108</td><td>16</td><td>Roland</td></tr>
    </table>
    <p class="tiny muted" style="margin-top:4pt">Rubriker i små versaler, linjer mellan raderna, ingen ram runt. Första kolumnen i fetstil.</p>
  </div>
  <div class="row cols-2 start">
    ${callout("Gör", "green", dots(["Knappar heter exakt som i appen, med samma kortkommando.", "En primär knapp per ruta."]))}
    ${callout("Gör inte", "teal", dots(["Egna färger på knappar eller block.", "Ikoner som inte finns i appen."], "dont"))}
  </div>
  ${f(p, n)}`,

  // 7. Statistik
  (p, n) => `${h()}
  <div><h2>Så skildrar vi statistik</h2><p class="lead" style="margin-top:3pt">Statistiken ska gå att läsa på några sekunder: först nyckeltalen, sedan ett diagram som svarar på en fråga. Som på hemsidan och under Min statistik.</p></div>
  <div class="row cols-2 start">
    ${callout("Gör", "green", dots([
      "Börja med tre eller fyra nyckeltal: rubrik, värde och vad det betyder.",
      "En serie, en färg. Huvudserien (inlärt, granskat) är alltid grön, sedan blå, orange och lila.",
      "Andelar som \"37 %\", med nämnaren intill: \"150 av 405\".",
      "Skriv ut värdet där läsaren behöver det: slutvärdet på linjen, värdet ovanför få staplar.",
      "Svaga rutnätslinjer, y-axeln från noll och högst fyra skalsteg.",
      "Områden har fast nummer och färg i alla diagram.",
      "Märk exempeldata som exempel; riktiga siffror får källa och datum.",
    ]))}
    ${callout("Gör inte", "teal", dots([
      "Färgade bakgrunder för nyckeltal.",
      "Tårtdiagram med flera kategorier, 3D eller dubbla y-axlar.",
      "Fler än fyra serier i samma diagram.",
      "Förklaring långt från diagrammet; den står direkt intill eller i diagrammet.",
      "Rött och grönt för bra och dåligt, utanför skattningsskalan.",
      "Decimaler som inte betyder något: 37,4 % blir 37 %.",
    ], "dont"))}
  </div>
  <h2>Välj rätt diagram</h2>
  <div class="card"><table class="t">
    <tr><th style="width:34%">Frågan</th><th style="width:30%">Diagram</th><th>Exempel</th></tr>
    ${[
      ["Hur mycket, just nu?", "Nyckeltal", "Inlärda kort, dagar i rad", 5],
      ["Hur stor andel, och av vad?", "Andelsstapel", "Granskade, att granska, ur rotation", 8],
      ["Hur långt har vi kommit?", "Framstegsstapel", "368 av 405 kort sedda", 8],
      ["Hur mycket per dag eller vecka?", "Stapeldiagram", "Repetitioner per dag", 9],
      ["Hur har det utvecklats?", "Linjediagram", "Inlärda och sedda kort över tid", 10],
      ["En enda andel, stort?", "Ringdiagram", "37 % inlärt", 10],
      ["Var är luckorna, per område?", "Radardiagram", "Kunskap per område (högst 14)", 11],
      ["Exakt hur långt i varje område?", "Områdesstaplar", "Inlärt och delvis inlärt per område", 12],
      ["Flera mått per rad?", "Tabell med staplar", "Granskningen per område", 12],
      ["Hur jämn är vanan?", "Aktivitetskarta", "Repetitioner per dag, tolv veckor", 13],
      ["Hur fördelar sig svaren?", "Skattningsfördelning", "Skattningar 1 till 5", 13],
      ["Hänger två mått ihop?", "Spridningsdiagram", "Andel inlärda mot snittskattning", 14],
    ].map(([q, d, e, pg]) => `<tr><td>${q}</td><td class="n">${d} <span class="muted" style="font-weight:400">s. ${pg}</span></td><td class="muted">${e}</td></tr>`).join("")}
  </table></div>
  ${f(p, n)}`,

  // 8. Andelsstapel och framstegsstapel
  (p, n) => `${h()}
  ${guide({
    title: "Andelsstapel",
    when: "När en helhet delas i två till fyra delar som tillsammans är 100 %, till exempel granskningens läge (som ReviewBar i appen).",
    render: () => `<div style="padding-top:4pt">${T.shareBar([{ ...REVIEW_SEGMENTS[0], value: 120 }, { ...REVIEW_SEGMENTS[1], value: 270 }, { ...REVIEW_SEGMENTS[2], value: 15 }], { height: "7pt" })}</div><p class="tiny muted" style="margin-top:6pt">120 av 405 kort granskade (30 %)</p>`,
    rules: ["Delarna i en logisk ordning: klart, kvar, borttaget.", "Förklaringen under stapeln med prick, namn och antal.", "Summan och andelen i klartext under, så att ingen behöver räkna."],
    fn: "shareBar([{ label, value, tone }])",
  })}
  ${guide({
    title: "Framstegsstapel",
    when: "Hur långt något har kommit mot ett mål, med en enda färg: sedda kort, granskade kort, dagar kvar till tentan. Som stapeln bredvid \"Inlärd kunskap\" på hemsidan.",
    render: () => `<div style="display:grid;grid-template-columns:auto 1fr;gap:10pt;align-items:center;padding-top:2pt"><div><div style="font-size:24pt;font-weight:800;line-height:1;letter-spacing:-0.02em">88<span style="font-size:13pt;color:var(--muted)"> %</span></div><div class="tiny" style="font-weight:700;margin-top:3pt">Inlärd kunskap</div></div><div>${T.progressBar(368, 405, { label: "368 av 405 kort sedda" })}</div></div>`,
    rules: ["Ett grönt spår på yta 3, rund ände.", "Talet i klartext under: \"368 av 405 kort sedda\".", "Flera delar i samma stapel? Använd andelsstapeln."],
    fn: "progressBar(värde, total, { label })",
  })}
  <div><h2>Så sitter delarna ihop</h2><p class="small muted" style="margin-top:2pt">Som kursblocket på hemsidan, och så vi helst sammanfattar statistik: stor siffra, framsteg, nyckeltal.</p></div>
  ${summaryBlock()}
  ${f(p, n)}`,

  // 9. Stapeldiagram
  (p, n) => `${h()}
  ${guide({
    title: "Stapeldiagram",
    when: "Mängd per tidsenhet: repetitioner per dag, nya kort per vecka. Som BarChart under Min statistik.",
    render: () => T.barChart({ labels: DAYS, values: REVIEWS, labelEvery: 4, w: 380, h: 190, highlight: REVIEWS.length - 1 }),
    rules: ["Rundade toppar (4 enheter), staplarna 62 % av platsen, högst 28 enheter breda.", "Etiketter på var fjärde dag och alltid den sista.", "Den senaste stapeln får gärna accentens mörkare ton."],
    fn: "barChart({ labels, values, labelEvery, highlight })",
  })}
  ${guide({
    title: "Staplade staplar",
    when: "När varje stapel består av två delar som båda betyder något, till exempel nya kort och repetitioner samma dag.",
    render: () => `${T.barChart({ labels: DAYS, values: REVIEWS.map((v, i) => [NEW[i], v - NEW[i]]), tones: ["chart-1", "chart-2"], labelEvery: 4, w: 380, h: 170 })}<div class="chart-legend"><span><span class="swatch" style="background:var(--chart-1)"></span>Nya kort</span><span><span class="swatch" style="background:var(--chart-2)"></span>Repetitioner</span></div>`,
    rules: ["Högst tre lager; det viktigaste lagret nederst.", "Förklaringen direkt under diagrammet.", "Bara toppen på stapeln är rundad."],
    fn: "barChart({ values: [[a, b]], tones })",
  })}
  ${f(p, n)}`,

  // 10. Linje och ring
  (p, n) => `${h()}
  ${guide({
    title: "Linjediagram",
    when: "Utveckling över tid: hur kunskapen växer, hur många kort som är sedda. Som \"Så växer din kunskap\" under Min statistik. Linje när värdet bygger vidare på det förra; staplar när varje period står för sig.",
    render: () => `${T.lineChart({ labels: DAYS, series: [{ name: "Inlärda", tone: "chart-1", values: LEARNED, area: true }, { name: "Sedda", tone: "chart-2", values: SEEN }], labelEvery: 4, w: 380, h: 190 })}<div class="chart-legend"><span><span class="swatch" style="background:var(--chart-1)"></span>Inlärda kort</span><span><span class="swatch" style="background:var(--chart-2)"></span>Sedda kort</span></div>`,
    rules: ["Linjen 2 enheter, rundade hörn; ytan under huvudserien 12 % täckning.", "Slutvärdet utskrivet i seriens färg, med en prick på sista punkten: PDF:en har ingen hovring.", "Högst fyra serier; jämförelser och mål som streckad linje."],
    fn: "lineChart({ labels, series: [{ name, tone, values, area, dashed }] })",
  })}
  ${guide({
    title: "Ringdiagram",
    when: "En enda andel som ska synas stort, till exempel på ett omslag. Aldrig för flera kategorier: då är andelsstapeln bättre.",
    render: () => `<div style="display:flex;gap:10pt;align-items:center"><div style="width:30%">${T.donut(150, 405, { label: "inlärt" })}</div><div class="small"><b style="font-size:13pt">150 av 405</b><br><span class="muted">kort inlärda efter 18 dagar</span></div></div>`,
    rules: ["En båge i accentens färg på ett spår i yta 3, rund ände.", "Procenten i mitten, nämnaren bredvid i klartext.", "Ringen börjar klockan tolv och går medsols."],
    fn: "donut(värde, total, { label })",
  })}
  ${f(p, n)}`,

  // 11. Radar
  (p, n) => `${h()}
  ${guide({
    title: "Radardiagram",
    when: "Kunskap per område, med alla områden samtidigt: var luckorna finns. Hemsidans huvudperson. Fem till fjorton områden.",
    render: () => `<div style="display:grid;gap:5pt"><div style="width:64%;margin:0 auto">${T.radarChart(AREAS)}</div>${T.radarList(AREAS)}</div>`,
    rules: ["Inlärda kort som fylld yta (60 %), delvis inlärda som ljus yta (7 %) utanför.", "Rutnät i fyra ringar: 25, 50, 75 och 100 %.", "Varje område har sitt nummer i områdets färg; namnen i listan bredvid eller under.", "Listan läses kolumnvis: första halvan till vänster, resten till höger."],
    fn: "radarChart(områden) och radarList(områden)",
  })}
  ${callout("Placering", "navy", `<p class="small">På en hel sida: radarn till vänster och listan till höger, som på hemsidan. I en halv kolumn: radarn överst och listan under i två kolumner, som här. Områdesnamnen kortas med tre punkter hellre än att radbrytas.</p>`)}
  ${f(p, n)}`,

  // 12. Områdesstaplar och tabell med staplar
  (p, n) => `${h()}
  ${guide({
    title: "Områdesstaplar",
    when: "Samma data som radarn när exakta värden behövs, eller när det finns fler än fjorton områden. Som listan bredvid radarn på hemsidan.",
    render: () => T.areaBars(AREAS.slice(0, 5)),
    rules: ["Nummer i områdets färg, namn, andel inlärda till höger och stapeln under.", "Inlärt fyllt, delvis inlärt i samma färg med 30 % täckning.", "Områdena i kursens ordning, så att numren stämmer med radarn."],
    fn: "areaBars(områden)",
  })}
  ${guide({
    title: "Tabell med staplar",
    when: "Flera mått per rad, när läsaren vill jämföra raderna: granskningen per område, framsteg per student. Som områdesraderna under Granskning.",
    render: () => T.barTable([
      { label: "Kristallstruktur", values: [20, 6, 2], color: 2 }, { label: "Fasdiagram", values: [30, 13, 2], color: 3 }, { label: "Brott och utmattning", values: [9, 21, 0], color: 6 }, { label: "Polymerers struktur", values: [37, 0, 0], color: 11 },
    ], { segments: REVIEW_SEGMENTS }),
    rules: ["Namnet med områdets prick, antalet, en smal andelsstapel och \"x av y\" längst till höger.", "Stapeln utan förklaring i varje rad; förklaringen en gång, ovanför eller under tabellen.", "Raderna i samma ordning som överallt annars."],
    fn: "barTable(rader, { segments })",
  })}
  ${f(p, n)}`,

  // 13. Aktivitetskarta och skattningar
  (p, n) => `${h()}
  ${guide({
    title: "Aktivitetskarta",
    when: "Hur jämn vanan är, dag för dag: en ruta per dag, måndag överst. Som aktivitetskartan under Min statistik.",
    render: () => `${T.heatmap(activity(), { weeks: 12 })}${T.heatmapScale()}`,
    rules: ["Fem nivåer: tom ruta i yta 3, sedan grönt med 25, 50, 75 och 100 % täckning.", "Nivåerna räknas från periodens högsta dag; förklaringen Mindre till Mer under.", "Månader överst, mån, ons och fre till vänster."],
    fn: "heatmap(antalPerDatum, { weeks })",
  })}
  ${guide({
    title: "Skattningsfördelning",
    when: "Hur studenterna skattar sig, 1 till 5, för ett kort, ett område eller en vecka.",
    render: () => `<div style="width:80%;margin:0 auto">${T.ratingChart([96, 143, 252, 281, 187], { w: 300, h: 160 })}</div>`,
    rules: ["Skattningsskalans färger och inga andra.", "Antalet ovanför varje stapel; staplarna i ordning 1 till 5.", "Använd inte skalan för annat än skattningar."],
    fn: "ratingChart([antal1, …, antal5])",
  })}
  ${f(p, n)}`,

  // 14. Spridning och diagrammet på sidan
  (p, n) => `${h()}
  ${guide({
    title: "Spridningsdiagram",
    when: "När två mått per kort eller student ska jämföras, till exempel för att hitta kluriga kort: få kan dem, och skattningen är låg.",
    render: () => `${T.scatter(cards(), { w: 340, h: 180, xLabel: "Andel som kan kortet", yLabel: "Snittskattning" })}<div class="chart-legend"><span><span class="dot" style="background:var(--chart-2);opacity:0.55"></span>Kort</span><span><span class="dot" style="background:var(--chart-3)"></span>Kluriga kort</span></div>`,
    rules: ["Punkterna i blått med 55 % täckning, så att täta områden syns.", "Det som ska hittas i orange, ovanpå, med en tunn ring.", "Båda axlarna namngivna under och till vänster."],
    fn: "scatter(punkter, { xLabel, yLabel })",
  })}
  <div><h2>Diagrammet på sidan</h2><p class="small muted" style="margin-top:2pt">Varje diagram står i ett eget block: en rubrik som säger vad det visar, en rad om period och urval, diagrammet med förklaring, och källan längst ner.</p></div>
  <div class="split" style="grid-template-columns:1.1fr 1fr">
    ${T.chartBlock({ title: "Repetitioner per dag", sub: "14 september till 1 oktober, en student", body: T.barChart({ labels: DAYS, values: REVIEWS, labelEvery: 6, w: 360, h: 150, highlight: REVIEWS.length - 1 }), source: "Källa: exempeldata. Riktiga siffror: tabellen review_log, hämtad 1 okt 2026." })}
    ${T.legend(["<b>Rubrik</b> 10,6 pt: vad diagrammet visar, utan \"Diagram över\".", "<b>Underrad</b> 8 pt, dämpad: period, urval och enhet.", "<b>Diagrammet</b> i full blockbredd, förklaringen direkt under.", "<b>Källa</b> 7,2 pt längst ner: var siffrorna kommer ifrån och när de hämtades."])}
  </div>
  ${callout("Läsbarhet", "teal", dots([
    "Text i diagram minst 7 pt när diagrammet står i sidan; skala inte ner ett diagram så att etiketterna blir mindre.",
    "Diagramfärgerna är kategoriska och kontrollerade mot både ljus och mörk yta (app/globals.css); byt inte ut dem mot egna.",
    "Färgen får aldrig vara det enda som bär informationen: förklaring, etikett eller värde står också i text.",
    "Kontrollera en utskrift i gråskala om PDF:en ska skrivas ut: serierna ska fortfarande gå att skilja åt.",
  ]))}
  ${f(p, n)}`,

  // 15. Mörkt tema
  (p, n) => `${h()}
  <div><h2>Mörkt tema för PDF:er</h2><p class="lead" style="margin-top:3pt">Ljust tema är standard: det skrivs ut bra och läses bäst på papper. Mörkt tema är för PDF:er som bara visas på skärm, till exempel på en projektor i ett mörkt rum.</p></div>
  <div class="split" style="grid-template-columns:0.95fr 1fr">
    ${darkMiniPage()}
    <div style="display:grid;gap:3.5mm">
      ${callout("Så slår du på det", "green", dots([
        "Hela dokumentet: <code>documentHtml({ dark: true })</code> sätter klassen <code>dark</code> på sidan.",
        "Sidhuvud och sidfot: <code>{ dark: true }</code> ger logotyperna för mörkt tema.",
        "En del av en ljus sida: lägg innehållet i ett element med klassen <code>dark</code>, som proven i den här PDF:en.",
      ]))}
      ${callout("Vad som ändras", "navy", dots([
        "Sidan blir duken (#101111) och ytorna ljusare nivåer av grått.",
        "Accenten och diagramfärgerna blir ljusare, så att de syns mot mörkt.",
        "Block tappar kanten; ljusheten skiljer dem åt.",
        "Skärmbilder tas i mörkt läge i appen, inte i ljust.",
      ]))}
      <div class="card"><h3>Logotyperna</h3><table class="t">
        <tr><th>Var</th><th>Ljust</th><th>Mörkt</th></tr>
        <tr><td class="n">Sidhuvud</td><td><code>logo-light.png</code></td><td><code>logo-dark.png</code></td></tr>
        <tr><td class="n">Sidfot</td><td><code>logo-menu-light.png</code></td><td><code>logo-menu-dark.png</code></td></tr>
      </table><p class="tiny muted" style="margin-top:4pt">Filerna ligger i <code>public/</code>.</p></div>
      ${callout("Kontrollera", "teal", dots([
        "Läs sidan på den skärm den ska visas på.",
        "Skriv inte ut mörka PDF:er; gör en ljus version.",
      ]))}
    </div>
  </div>
  ${f(p, n)}`,

  // 16. Arbetssätt
  (p, n) => `${h()}
  <div><h2>Så återskapar du en PDF</h2><p class="lead" style="margin-top:3pt">Allt finns i repot. Ett kommando bygger HTML, PDF och sidbilder, och stoppar om något är fel.</p></div>
  ${T.steps([
    ["Starta testkopian", "Bara om PDF:en har skärmbilder: bygg och starta 3001 (se nedan)."],
    ["Ta skärmbilderna", "Kör dokumentets skärmbildsskript; bilderna hamnar i docs/."],
    ["Bygg", "<code>npm run pdf</code> bygger alla. Ett dokument: lägg till namnet."],
    ["Granska", "Titta på varje sidbild (sökvägen skrivs ut). Rätta och bygg igen."],
  ])}
  <div class="card"><h3>Filerna</h3><table class="t">
    <tr><td class="n" style="width:46%"><code>scripts/pdf/tema.cjs</code></td><td>Tokens, CSS, komponenter och diagram.</td></tr>
    <tr><td class="n"><code>scripts/pdf/skriv-ut.cjs</code></td><td>PDF med Chromium, kontroller och sidbilder.</td></tr>
    <tr><td class="n"><code>scripts/pdf/bygg.cjs</code></td><td>Kommandot <code>npm run pdf -- [namn]</code>.</td></tr>
    <tr><td class="n"><code>scripts/pdf/designsystem.cjs</code></td><td>Den här PDF:en.</td></tr>
    <tr><td class="n"><code>scripts/pdf/granskningsguide.cjs</code></td><td>Granskningsguiderna, svenska och engelska.</td></tr>
    <tr><td class="n"><code>scripts/pdf/skarmbilder-granskning.cjs</code></td><td>Guidernas skärmbilder, mot 3001.</td></tr>
    <tr><td class="n"><code>docs/&lt;namn&gt;.pdf</code></td><td>Resultatet; HTML-källan i en mapp bredvid.</td></tr>
  </table></div>
  <div class="row cols-2 start">
    ${callout("Bygget stoppar om", "teal", dots(["en sida rinner över,", "Figtree inte laddas,", "en bild saknas,", "mittpunkten (U+00B7) finns någonstans."], "dont"))}
    ${callout("Testkopian på 3001", "navy", `<p class="small">Bygg med <code>NEXT_DIST_DIR=.next-prod npx next build</code>, återställ sedan <code>tsconfig.json</code> och starta förhandsvisningen kuggfri-3001. Skärmbilderna tas mot den lokala databasen, aldrig mot produktionen.</p>`)}
  </div>
  <div class="card"><h3>En ny PDF</h3>
    <ol class="legend" style="margin-top:3pt">${[
      "Kopiera <code>scripts/pdf/granskningsguide.cjs</code> till en ny fil och byt mapp och namn.",
      "Skriv sidorna som funktioner som får sidnumret: sidhuvud, innehåll av komponenterna här, sidfot.",
      "Lägg till dokumentet i <code>DOKUMENT</code> i <code>scripts/pdf/bygg.cjs</code>.",
      "Bygg, granska varje sidbild och be om en andra genomläsning innan PDF:en skickas.",
    ].map((t, i) => `<li>${num(i + 1)}<span>${t}</span></li>`).join("")}</ol>
  </div>
  <div class="row cols-2 start">
    ${callout("Innan PDF:en skickas", "green", dots([
      "Varje sidbild granskad: inget beskuret, krockande eller tomt.",
      "Siffrorna kontrollerade mot källan, med datum.",
      "Knappar, flikar och namn exakt som i appen.",
      "Rätt språk för läsaren, och samma ton som i appen.",
    ]))}
    ${callout("När något ändras i appen", "navy", dots([
      "Nya tokens i app/globals.css förs över till LIGHT och DARK i tema.cjs.",
      "Ändrade vyer: ta om skärmbilderna och bygg om alla PDF:er, även den här.",
    ]))}
  </div>
  ${f(p, n)}`,
];

/** Kursblocket från hemsidan: kursen, inlärd kunskap med framstegsstapel och fyra nyckeltal. */
function summaryBlock() {
  const small = (t) => T.tile(t).replace('class="tile"', 'class="tile" style="padding:7pt 8pt 8pt"').replace('class="v"', 'class="v" style="font-size:15pt;margin-top:5pt"');
  const block = () => `<div class="card" style="padding:10pt 12pt">
    <div style="display:flex;align-items:center;gap:7pt"><span style="width:18pt;height:18pt;border-radius:6pt;background:var(--accent-soft);display:inline-flex;align-items:center;justify-content:center;color:var(--accent-ink);font-weight:800;font-size:8pt">M</span><div><div style="font-weight:750;font-size:10pt">Materialteknik</div><div class="tiny muted">MTT085, 405 kort</div></div></div>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:12pt;align-items:center;margin:8pt 0"><div><div style="font-size:24pt;font-weight:800;line-height:1;letter-spacing:-0.02em">88<span style="font-size:12pt;color:var(--muted)"> %</span></div><div class="tiny" style="font-weight:700;margin-top:2pt">Inlärd kunskap</div></div><div>${T.progressBar(368, 405, { label: "368 av 405 kort sedda" })}</div></div>
    <div class="row cols-4" style="gap:2.5mm">${[["Inlärda", "150", "37 %", "green"], ["I rad", "18", "dagar", "navy"], ["I dag", "0", "28 kvar", "teal"], ["Snitt", "3,5", "av 5", "violet"]].map(small).join("")}</div>
  </div>`;
  return `<div class="row cols-2">${block()}<div class="dark" style="border-radius:var(--radius-lg)">${block()}</div></div>`;
}

/** Sidmallen i miniatyr, med marginaler och delar utmärkta. */
function pageAnatomy() {
  const W = 210, H = 297, k = 0.82;
  const box = (x, y, w, hh, fill, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="2" fill="${fill}" ${extra}/>`;
  return `<svg class="chart" viewBox="-14 -6 ${W + 28} ${H + 12}" style="max-height:${H * k}pt">
    ${box(0, 0, W, H, "var(--page)", 'stroke="var(--line-strong)"')}
    <rect x="14" y="13" width="${W - 28}" height="${H - 23}" fill="none" stroke="var(--chart-2)" stroke-dasharray="3 2" stroke-width="0.8"/>
    ${box(14, 13, 30, 11, "var(--surface-3)")}${box(W - 70, 15, 56, 3, "var(--accent)")}${box(W - 60, 20, 46, 3, "var(--surface-3)")}
    ${box(14, 32, 150, 9, "var(--fg)")}${box(14, 45, 170, 4, "var(--surface-3)")}${box(14, 51, 120, 4, "var(--surface-3)")}
    ${[0, 1, 2, 3].map((i) => box(14 + i * 46, 60, 42, 22, "var(--surface-2)")).join("")}
    ${box(14, 88, 182, 70, "var(--surface)", 'stroke="var(--line)"')}${box(14, 164, 89, 55, "var(--surface-2)")}${box(107, 164, 89, 55, "var(--surface-2)")}
    <line x1="14" x2="${W - 14}" y1="${H - 19}" y2="${H - 19}" stroke="var(--line)"/>${box(14, H - 16, 20, 6, "var(--surface-3)")}${box(W - 90, H - 15, 76, 3, "var(--surface-3)")}
    ${[[1, 4, 18], [2, 4, 46], [3, 4, 120], [4, 4, H - 13]].map(([nn, x, y]) => `<circle cx="${x - 9}" cy="${y}" r="5.5" fill="var(--accent)"/><text x="${x - 9}" y="${y + 2.3}" text-anchor="middle" font-size="6.5" font-weight="800" fill="var(--accent-fg)">${nn}</text>`).join("")}
    <text x="${W / 2}" y="9" text-anchor="middle" font-size="6" fill="var(--chart-2)">13 mm</text>
    <text x="${W / 2}" y="${H - 1}" text-anchor="middle" font-size="6" fill="var(--chart-2)">10 mm</text>
    <text x="${W - 7}" y="${H / 2}" text-anchor="middle" font-size="6" fill="var(--chart-2)" transform="rotate(90 ${W - 7} ${H / 2})">14 mm</text>
  </svg>`;
}

/** En sida i mörkt tema i miniatyr: sidhuvud, nyckeltal och ett diagram. */
function darkMiniPage() {
  return `<div class="dark" style="background:var(--page);border-radius:12px;padding:9pt 10pt;display:grid;gap:7pt;align-content:start">
    <div style="display:flex;justify-content:space-between;align-items:center"><img src="${T.asset(DIR, "public/logo-dark.png")}" alt="" style="height:7mm"><div style="text-align:right"><div class="eyebrow" style="font-size:6pt">Veckorapport</div><div class="tiny muted">Materialteknik MTT085</div></div></div>
    <div style="font-size:14pt;font-weight:800;letter-spacing:-0.01em;line-height:1.1">Så gick veckan</div>
    <div class="row cols-2" style="gap:5pt">${T.tile(["Inlärda kort", "150", "37 % av 405", "green"])}${T.tile(["Dagar i rad", "18", "2 frysningar kvar", "navy"])}</div>
    <div style="background:var(--surface);border-radius:12px;padding:7pt 8pt"><div style="font-size:8.5pt;font-weight:750;margin-bottom:3pt">Repetitioner per dag</div>${T.barChart({ labels: DAYS, values: REVIEWS, labelEvery: 6, w: 320, h: 150, highlight: REVIEWS.length - 1 })}</div>
    <div style="background:var(--surface);border-radius:12px;padding:7pt 8pt"><div style="font-size:8.5pt;font-weight:750;margin-bottom:3pt">Kunskap per område</div><div style="width:58%;margin:0 auto 4pt">${T.radarChart(AREAS)}</div>${T.radarList(AREAS)}</div>
  </div>`;
}

async function bygg(skrivUt) {
  await skrivUt({
    name: "Designsystem",
    html: T.documentHtml({ htmlDir: DIR, title: "Designsystem för Kuggfris PDF:er", pages: PAGES }),
    htmlFile: path.join(DIR, "Designsystem.html"),
    pdfFile: path.join(T.ROOT, "docs", "Designsystem.pdf"),
  });
}

module.exports = { bygg };
