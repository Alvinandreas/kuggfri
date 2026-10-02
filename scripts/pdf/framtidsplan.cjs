/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Framtidsplanen: hur Kuggfri förbättras, skalas och säkras efter Materialteknik HT26.
 * Bygger på docs/OMVARLDSANALYS.md (marknad och forskning), DECISIONS.md (vad som redan finns),
 * TASKS.md (öppna punkter) och läget i produktionen 2 okt 2026.
 *
 *   npm run pdf -- framtidsplan
 */
const path = require("path");
const T = require("./tema.cjs");
const { callout, dots, num } = T;

const DIR = path.join(T.ROOT, "docs/framtidsplan");
const h = () => T.header(DIR, { eyebrow: "Framtidsplan", meta: "Kuggfri 2026/27 och framåt" });
const f = (p, n) => T.footer(DIR, { left: "Kuggfri, framtidsplan, oktober 2026", page: p, pages: n });
const title = (t, lead) => `<div><h2>${t}</h2>${lead ? `<p class="lead" style="margin-top:3pt">${lead}</p>` : ""}</div>`;
const table = (head, rows, widths = []) =>
  `<table class="t"><tr>${head.map((x, i) => `<th${widths[i] ? ` style="width:${widths[i]}"` : ""}>${x}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="n"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</table>`;
const tableNowrapLast = (head, rows, widths = []) =>
  table(head, rows, widths).replace(/<td>([^<]*)<\/td><\/tr>/g, '<td style="white-space:nowrap">$1</td></tr>');

/** Riskmatrisen: sannolikhet mot konsekvens, riskerna som numrerade punkter. */
function riskMatrix(points) {
  const W = 300, H = 196, L = 46, B = 28, cw = (W - L) / 3, ch = (H - B - 8) / 3;
  const shade = (c, r) => ["surface-2", "surface-3", "chart-3"][Math.min(2, Math.floor((c + r) / 2))];
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const tone = shade(c, 2 - r);
    s += `<rect x="${L + c * cw + 1.5}" y="${8 + r * ch + 1.5}" width="${cw - 3}" height="${ch - 3}" rx="8" fill="var(--${tone})"${tone === "chart-3" ? ' fill-opacity="0.22"' : ""}/>`;
  }
  ["Låg", "Medel", "Hög"].forEach((t, i) => {
    s += `<text x="${L + i * cw + cw / 2}" y="${H - 14}" text-anchor="middle" font-size="8" fill="var(--muted)">${t}</text>`;
    s += `<text x="${L - 6}" y="${8 + (2 - i) * ch + ch / 2 + 3}" text-anchor="end" font-size="8" fill="var(--muted)">${t}</text>`;
  });
  s += `<text x="${L + (W - L) / 2}" y="${H - 2}" text-anchor="middle" font-size="8" font-weight="700" fill="var(--fg)">Sannolikhet</text>`;
  s += `<text x="9" y="${8 + (H - B - 8) / 2}" text-anchor="middle" font-size="8" font-weight="700" fill="var(--fg)" transform="rotate(-90 9 ${8 + (H - B - 8) / 2})">Konsekvens</text>`;
  const slots = {};
  points.forEach(([n, c, r]) => {
    const key = c + "-" + r;
    const k = (slots[key] = (slots[key] ?? -1) + 1);
    const x = L + c * cw + 18 + (k % 4) * 22, y = 8 + (2 - r) * ch + 20 + Math.floor(k / 4) * 22;
    s += `<circle cx="${x}" cy="${y}" r="9" fill="var(--accent)"/><text x="${x}" y="${y + 3.2}" text-anchor="middle" font-size="8.5" font-weight="800" fill="var(--accent-fg)">${n}</text>`;
  });
  return s + "</svg>";
}

const phaseHead = (n, name, when, goal) =>
  `<div style="display:flex;gap:9pt;align-items:flex-start">${num(n)}<div><h2 style="margin:0">${name}</h2><p class="small muted" style="margin:2pt 0 0">${when}</p><p class="lead" style="margin-top:4pt">${goal}</p></div></div>`;
const gate = (name, items) => `<div class="card"><h3>${T.dot("green")} ${name}</h3>${dots(items)}</div>`;

/** Tidslinjen okt 2026 till dec 2027: faser som staplar, grindar som diamanter. */
function roadmap() {
  const months = ["okt", "nov", "dec", "jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const L = 150, W = 500, top = 26, row = 26, colW = (W - L) / months.length;
  const x = (m) => L + m * colW; // m = månader sedan okt 2026
  const phases = [
    ["1. Lär av första kursen", 0, 4, "chart-1"],
    ["2. Grunden för fler kurser", 1.2, 6, "chart-2"],
    ["3. Tre till fem kurser", 3.2, 9, "chart-3"],
    ["4. Hemvist och fler program", 6.5, 15, "chart-4"],
    ["Löpande: innehåll och förvaltning", 0, 15, "line-strong"],
  ];
  const gates = [["G1", 1.4], ["G2", 3.2], ["G3", 8.7]];
  let s = `<svg class="chart" viewBox="0 0 ${W} ${top + phases.length * row + 30}" role="img">`;
  s += `<text x="${x(0)}" y="10" font-size="8" font-weight="700" fill="var(--muted)">2026</text><text x="${x(3)}" y="10" font-size="8" font-weight="700" fill="var(--muted)">2027</text>`;
  months.forEach((m, i) => {
    s += `<text x="${x(i) + colW / 2}" y="22" text-anchor="middle" font-size="7.5" fill="var(--muted)">${m}</text>`;
    s += `<line x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${top + phases.length * row}" stroke="var(--chart-grid)"/>`;
  });
  phases.forEach(([name, a, b, tone], i) => {
    const y = top + i * row + 7;
    s += `<text x="0" y="${y + 11}" font-size="9" font-weight="700" fill="var(--fg)">${name}</text>`;
    s += `<rect x="${x(a)}" y="${y}" width="${x(b) - x(a)}" height="15" rx="7.5" fill="var(--${tone})"${tone === "line-strong" ? ' fill-opacity="0.6"' : ""}/>`;
  });
  const gy = top + phases.length * row + 12;
  gates.forEach(([g, m]) => {
    s += `<line x1="${x(m)}" x2="${x(m)}" y1="${top}" y2="${gy - 6}" stroke="var(--fg)" stroke-dasharray="2 2"/>`;
    s += `<rect x="${x(m) - 5}" y="${gy - 5}" width="10" height="10" transform="rotate(45 ${x(m)} ${gy})" fill="var(--fg)"/>`;
    s += `<text x="${x(m)}" y="${gy + 16}" text-anchor="middle" font-size="8.5" font-weight="800" fill="var(--fg)">${g}</text>`;
  });
  return s + "</svg>";
}

/** Innehållsmotorn som flöde: sex steg i rad med pilar. */
function pipeline() {
  const steps = [["Material", "Kursens källor"], ["Utkast", "Med sidhänvisning"], ["Kontroll", "Oberoende, mot källan"], ["Examinatorn", "Godkänner"], ["Publicerat", "Studenterna pluggar"], ["Underhåll", "Rapporter och tentan"]];
  const W = 520, bw = 78, gap = (W - steps.length * bw) / (steps.length - 1);
  let s = `<svg class="chart" viewBox="0 0 ${W} 74" role="img">`;
  steps.forEach(([t, d], i) => {
    const x0 = i * (bw + gap);
    s += `<rect x="${x0}" y="6" width="${bw}" height="52" rx="10" fill="var(--surface-2)"/>`;
    s += `<circle cx="${x0 + 12}" cy="18" r="6.5" fill="var(--accent)"/><text x="${x0 + 12}" y="21" text-anchor="middle" font-size="7.5" font-weight="800" fill="var(--accent-fg)">${i + 1}</text>`;
    s += `<text x="${x0 + 8}" y="38" font-size="8.6" font-weight="800" fill="var(--fg)">${t}</text>`;
    s += `<text x="${x0 + 8}" y="50" font-size="6.6" fill="var(--muted)">${d}</text>`;
    if (i < steps.length - 1) s += `<path d="M${x0 + bw + 2} 32 h${gap - 6}" stroke="var(--line-strong)" stroke-width="1.5" marker-end="url(#pil)"/>`;
  });
  s += `<path d="M${W - bw / 2} 60 v8 H${bw / 2} v-6" fill="none" stroke="var(--chart-2)" stroke-width="1.3" stroke-dasharray="3 2" marker-end="url(#pil2)"/>`;
  s = s.replace("<svg", `<svg`).replace('role="img">', `role="img"><defs><marker id="pil" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--line-strong)"/></marker><marker id="pil2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--chart-2)"/></marker></defs>`);
  return s + "</svg>";
}

const PAGES = [
  // 1. Omslag och sammanfattning
  (p, n) => `${h()}
  <h1>Framtidsplan för Kuggfri</h1>
  <p class="lead">Från en kurs till en självklar del av kurserna på Chalmers: hur vi förbättrar, skalar och säkrar Kuggfri efter Materialteknik HT26. Planen gäller läsåret 2026/27 och sätter riktningen för 2027/28. <strong>Varje steg har en grind med mätbara kriterier, så att vi växer på belägg och inte på förhoppningar.</strong></p>
  ${T.tiles([
    ["Kurser VT27", "3–5", "efter grind G2, med examinatorer som vill", "green"],
    ["Veckoaktiva", "≥ 50 %", "av kursens studenter under läsperioden", "navy"],
    ["Kommer tillbaka", "≥ 40 %", "gör ett andra pass inom tre dagar", "teal"],
    ["Förvaltare", "≥ 2", "personer som kan driva tjänsten", "violet"],
  ])}
  <div class="card"><h3>Sammanfattning i sex teser</h3><ol class="legend" style="margin-top:4pt">${[
    "<b>Produkten är inte längre flaskhalsen.</b> Dosering, streak, tentadatum, flerval, granskning, statistik och språk finns. Det som avgör tillväxten är innehållet, examinatorerna och förvaltningen.",
    "<b>Första kursomgången är ett experiment.</b> Vi mäter, lär och ändrar lite under läsperioden, och gör de stora ändringarna efter tentan, med examinatorerna.",
    "<b>Vi växer via examinatorer, en kurs i taget,</b> med en upprepbar startmodell: en kurs är redo på fyra veckor, med granskat innehåll från dag ett.",
    "<b>Innehållsmotorn industrialiseras utan att källkritiken släpps:</b> utkast ur kursens material, oberoende kontroll av varje påstående, examinatorns godkännande. Människan beslutar alltid.",
    "<b>Driften säkras innan den belastas:</b> två personer som kan driva tjänsten, dokumenterad drift, säkerhetskopior utanför en enda dator och en långsiktig hemvist.",
    "<b>Belägg före bredd.</b> Löftet gratis, kursägt, källgranskat och utan spårning är det som skiljer Kuggfri från alla kommersiella aktörer. Det offras aldrig för tillväxt.",
  ].map((t, i) => `<li>${num(i + 1)}<span>${t}</span></li>`).join("")}</ol></div>
  <div class="card"><h3>Innehåll</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 8mm;margin-top:3pt">${[
    ["Utgångsläget och hypoteserna", 2], ["Principerna", 3], ["Mätramverket", 4], ["Färdplanen och grindarna", 5],
    ["Fas 1: Lär av första kursen", 6], ["Fas 2: Grunden för fler kurser", 7], ["Fas 3: Tre till fem kurser", 8], ["Fas 4: Hemvist och fler program", 9],
    ["Innehållsmotorn", 10], ["Risker och motåtgärder", 11], ["De närmaste 90 dagarna", 12],
  ].map(([a, pg]) => `<div style="display:flex;justify-content:space-between;gap:8pt;padding:3pt 0;border-bottom:1px solid var(--line);font-size:8.8pt"><span>${a}</span><span class="muted">${pg}</span></div>`).join("")}</div></div>
  ${f(p, n)}`,

  // 2. Utgångsläget
  (p, n) => `${h()}
  ${title("Utgångsläget", "Kuggfri lanseras för Materialteknik (MTT085) med 405 källgranskade kort i 14 områden, två examinatorer och omkring 200 studenter. Det är en ovanligt stark start för en ny tjänst, och en ovanligt sårbar organisation.")}
  <div class="row cols-2 start">
    <div class="card"><h3>Styrkor att skydda</h3>${dots([
      "<b>Inlärningsmotorn:</b> FSRS med dosering, tentadatum, slutrepetition, streak med frysningar och plugga vidare.",
      "<b>Kvalitetsslingan:</b> källa på varje kort, oberoende kontroll, examinatorns granskning och felrapporter från studenterna.",
      "<b>Insyn för examinatorn</b> med anonymitetsgräns, veckobrev och kursöversikt.",
      "<b>Förtroende:</b> gratis, ingen reklam, ingen spårning, data inom EU, tillgänglighetstestat.",
      "<b>Hantverket:</b> designsystem, automatiska tester, återställningsrutin och dokumentation.",
    ])}</div>
    <div class="card"><h3>Svagheter att åtgärda</h3>${dots([
      "<b>En person bär allt:</b> drift, innehåll och kod. Ingen annan har övat driften.",
      "<b>Innehållet är dyrt:</b> en kurs kräver hundratals kort med källa, kontroll och granskning.",
      "<b>Säkerhetskopiorna</b> finns bara på en dator, och körs bara när den är på.",
      "<b>En kurs i taget</b> i gränssnittet; ingen självbetjäning för nästa examinator.",
      "<b>Inga belägg än</b> för att det fungerar i just den här kursen.",
    ], "dont")}</div>
  </div>
  <div><h2>Det Materialteknik ska visa</h2><p class="small muted" style="margin-top:2pt">Fem hypoteser som prövas under första kursomgången. De avgör grind G1.</p></div>
  <div class="card">${table(["Hypotes", "Mått", "Mål"], [
    ["H1. Studenterna kommer tillbaka", "Andel som gör ett andra pass inom tre dagar efter det första", "≥ 40 %"],
    ["H2. Det blir en vana", "Veckoaktiva av kursens registrerade studenter under läsperioden", "≥ 50 %"],
    ["H3. Examinatorn använder insynen", "Veckobrevet läses och översikten används inför en föreläsning eller tentan", "Varje vecka"],
    ["H4. Innehållet håller", "Felrapporter som leder till en rättelse, per 100 kort", "< 3"],
    ["H5. Studenterna upplever nytta", "Fråga i kursutvärderingen: Kuggfri hjälpte mig inför tentan", "≥ 70 % instämmer"],
  ], ["30%", "50%"])}</div>
  ${callout("Varför just de här", "navy", `<p class="small">H1 och H2 är de tidigaste signalerna på om en studievana uppstår (utbildningsappar i allmänhet ligger långt under, kursverktyg med lärarstöd ska ligga högt över). H3 avgör om examinatorn blir en ambassadör. H4 skyddar förtroendet. H5 är det som övertygar nästa examinator.</p>`)}
  ${f(p, n)}`,

  // 3. Principer
  (p, n) => `${h()}
  ${title("Principerna", "Åtta regler som gäller i varje fas. När ett beslut är svårt avgör de; när en idé bryter mot dem byggs den inte.")}
  <div class="row cols-2">${[
    ["Kursen äger innehållet", "Allt kan exporteras när som helst. Examinatorn bestämmer vad som är rätt, och krediteras."],
    ["Inget utan källa och människa", "Varje kort bygger på kursens material, kontrolleras oberoende och godkänns av en människa. Gäller också AI-utkast."],
    ["Gratis och fritt för studenten", "Ingen betalvägg, ingen reklam, ingen försäljning av data. Kostnader bärs av någon annan än studenten."],
    ["Integritet som standard", "Minimal insamling, EU, ingen tredjepartsanalys. Examinatorn ser bara sammanställt, med anonymitetsgräns."],
    ["Inga mörka mönster", "Inga skuldmejl, inga topplistor i betygsatta kurser, inga hjärtan eller energi. Studenten får bara mejl hen bett om."],
    ["Examinatorn är kanalen", "Tillväxten sker genom lärare som vill använda det, inte genom marknadsföring till studenter."],
    ["En sak i taget, och mät den", "Varje större ändring har en hypotes och ett mått. Det som inte gör skillnad tas bort."],
    ["Driften före funktionerna", "En ny kurs startar först när driften klarar den: säkerhetskopior, övervakning och någon som kan ta över."],
  ].map(([t, d], i) => `<div class="decision"><div class="head">${num(i + 1)}<h3 style="margin:0">${t}</h3></div><p>${d}</p></div>`).join("")}</div>
  <div class="card"><h3>Det vi inte bygger</h3>${table(["Idé", "Varför inte"], [
    ["Offentliga topplistor och poäng för snabbhet", "Sänker motivationen hos den nedre halvan och belönar fel saker i en betygsatt kurs."],
    ["Påminnelser och skuldnotiser till studenter", "Alvins beslut: studenten får bara mejl hen själv begär. Vanan byggs i produkten, inte i inkorgen."],
    ["Publicering av AI-genererade kort utan granskning", "Ett fel lärs in av hundratals studenter. Utkast ja, automatisk publicering aldrig."],
    ["En öppen marknadsplats för användarskapade kortlekar", "Kvaliteten går inte att garantera, och det är kvaliteten som skiljer oss från Quizlet."],
    ["Betalversion eller premiumfunktioner", "Bryter löftet till studenterna och förtroendet hos examinatorerna."],
  ], ["38%"])}</div>
  ${f(p, n)}`,

  // 4. Mätramverk
  (p, n) => `${h()}
  ${title("Mätramverket", "Ett ledstjärnemått och en handfull ledande mått, alla ur Kuggfris egen historik och alltid sammanställda. Ingen tredjepartsanalys och inga enskilda studenter.")}
  <div class="row start" style="grid-template-columns:1fr 1.5fr">
    <div class="tile" style="padding:14pt"><div class="k">${T.dot("green")}Ledstjärnan</div><div class="v" style="font-size:16pt;white-space:normal;line-height:1.15">Veckoaktiva studenter i granskade kurser</div><div class="l">Fångar på en gång att innehållet är granskat, att kurserna blir fler och att studenterna faktiskt använder det. Mäts per vecka under läsperioderna.</div></div>
    <div class="card"><h3>Ledande mått</h3>${tableNowrapLast(["Mått", "Definition", "Mål"], [
      ["Aktivering", "Minst 20 repetitioner första dagen, av dem som börjat", "≥ 60 %"],
      ["Återkomst", "Andra pass inom tre dagar", "≥ 40 %"],
      ["Vana", "Veckoaktiva av kursens studenter", "≥ 50 %"],
      ["Beredskap", "Uppskattad kunskap dagen före tentan, för aktiva", "≥ 85 %"],
      ["Kvalitet", "Rättelser efter felrapport, per 100 kort", "< 3"],
      ["Svarstid", "Felrapport åtgärdad", "inom 7 dagar"],
      ["Examinatorns tid", "Granskning per ny kurs", "< 8 h"],
    ], ["24%", "58%"])}</div>
  </div>
  ${T.chartBlock({
    title: "Så ser en lyckad läsperiod ut",
    sub: "Veckoaktiva av kursens studenter, vecka för vecka. Illustration av målbilden, inte data.",
    body: `${T.lineChart({ labels: ["v. 1", "v. 2", "v. 3", "v. 4", "v. 5", "v. 6", "v. 7", "tenta"], series: [{ name: "Målbild", tone: "chart-1", values: [72, 64, 58, 55, 54, 58, 70, 85], area: true }, { name: "Mål", tone: "chart-3", values: [50, 50, 50, 50, 50, 50, 50, 50], dashed: true }], w: 520, h: 118, unit: " %" })}<div class="chart-legend"><span><span class="swatch" style="background:var(--chart-1)"></span>Målbild: ett fall efter första veckan, en stabil platå och en topp inför tentan</span><span><span class="swatch" style="background:var(--chart-3)"></span>Målet 50 %</span></div>`,
    source: "Källa: målbilden i planen. Riktiga siffror finns i kursöversikten under Materialteknik HT26.",
  })}
  <div class="row cols-2 start">
    ${callout("Så utvärderar vi effekten", "navy", dots([
      "En fråga i kursutvärderingen om upplevd nytta, varje kursomgång.",
      "Sammanställd användning före tentan mot kursens resultat på gruppnivå, aldrig per student.",
      "Jämförelser mellan år eller kurser redovisas som samband, inte som orsak.",
      "Studier som kopplar enskildas användning till betyg görs bara med samtycke och etikprövning.",
    ]))}
    ${callout("Varje kvartal", "teal", dots([
      "Måtten per kurs i en enkel rapport till examinatorerna.",
      "En funktion som inte flyttat sitt mått på två kvartal omprövas.",
      "Felrapporterna gås igenom: mönster blir rättelser i innehållsmotorn.",
      "Driften: kostnad, incidenter, säkerhetskopior och återställningstest.",
    ]))}
  </div>
  ${f(p, n)}`,

  // 5. Färdplan
  (p, n) => `${h()}
  ${title("Färdplanen och grindarna", "Fyra faser som delvis överlappar. Mellan dem ligger grindar: en fas startar på allvar först när föregående grind är passerad.")}
  <div class="card">${roadmap()}</div>
  <div class="row cols-3 start">
    ${gate("G1, efter LP1-tentan (nov 2026)", ["H1 och H2 nådda, eller tydligt förklarade.", "Inga kända fel kvar i innehållet.", "Examinatorerna vill fortsätta och rekommendera."])}
    ${gate("G2, före LP3 (jan 2027)", ["Två personer kan driva tjänsten, och återställningen är övad.", "Säkerhetskopior finns utanför en dator.", "Minst två nya examinatorer har tackat ja."])}
    ${gate("G3, efter VT27 (jun 2027)", ["Minst tre kurser har gått en hel läsperiod.", "Ledstjärnan växer med antalet kurser.", "Ett beslut om hemvist och finansiering."])}
  </div>
  <div class="card"><h3>Vad varje fas lämnar efter sig</h3>${table(["Fas", "Leverans", "Bevis"], [
    ["1. Lär av första kursen", "Rapport efter kursomgången, retro och reviderat innehåll", "Måtten H1 till H5"],
    ["2. Grunden för fler kurser", "Medförvaltare, DRIFT.md, säkerhetskopior i molnet, innehållsmotorn v2", "En övad återställning och en testkurs på fyra veckor"],
    ["3. Tre till fem kurser", "Startmodellen, föreslå ett kort och kurser som gått en hel period", "Ledstjärnan per kurs"],
    ["4. Hemvist och fler program", "Ett beslut om hemvist, avtal och finansiering", "Tjänsten drivs utan en enda nyckelperson"],
  ], ["26%", "46%"])}</div>
  ${callout("Passeras inte en grind", "navy", `<p class="small">Då stannar vi i fasen och åtgärdar orsaken, i stället för att växa på en svag grund. Att stanna vid en eller två välfungerande kurser är ett bättre utfall än tio halvfärdiga.</p>`)}
  ${f(p, n)}`,

  // 6. Fas 1
  (p, n) => `${h()}
  ${phaseHead(1, "Lär av första kursen", "Oktober 2026 till januari 2027: från lanseringen till efter LP1-tentan", "Målet är att förstå hur tjänsten används, att hålla innehållet felfritt och att lämna kursen med belägg och nöjda examinatorer. Under läsperioden ändras lite; efter tentan ändras mycket.")}
  <div class="row cols-2 start">
    <div class="card"><h3>Under läsperioden</h3>${dots([
      "<b>Lugn drift:</b> ingen migration samma dag som en föreläsning, återställningsrutinen före varje ändring.",
      "<b>Felrapporter inom 48 timmar:</b> rättelse via kortfilerna med källa, examinatorn godkänner.",
      "<b>Veckovis avstämning</b> av aktivering och återkomst; tidiga avvikelser utreds direkt.",
      "<b>Skattningsskalan:</b> studenttestet första veckan avgör om 3 (Med möda) missbrukas.",
      "<b>Inför tentan:</b> slutrepetitionen och beredskapen per område följs upp; Tentaläget öppnas om examinatorn vill.",
    ])}</div>
    <div class="card"><h3>Efter tentan</h3>${dots([
      "<b>Retro med examinatorerna:</b> kluriga kort, felrapporter, områden med låg beredskap.",
      "<b>Rapport efter kursomgången:</b> måtten H1 till H5, med jämförelser redovisade som samband.",
      "<b>Kursutvärderingens fråga</b> sammanställd tillsammans med kursledningen.",
      "<b>Innehållsrevision:</b> kort som ofta skattas lågt ses över; dubbletter och tvetydigheter rensas.",
      "<b>Studentintervjuer:</b> fem till tio korta samtal om vad som fick dem att komma tillbaka, eller inte.",
    ])}</div>
  </div>
  <div class="card"><h3>Förbättringar som väntar på belägg</h3>${table(["Förbättring", "Utlöses av", "Storlek"], [
    ["Tydligare beredskap per område inför tentan", "Studenterna läser inte beredskapen rätt", "Liten"],
    ["Ändrad skattningsskala", "Studenttestet visar att 3 missbrukas", "Liten"],
    ["Fullt offlineläge (service worker)", "Felrapporter om tappad anslutning trots utkorgen", "Mellan"],
    ["Fler kortformer: skriv svaret, lucktext", "Examinatorn efterfrågar dem för räkne- och begreppsfrågor", "Stor"],
    ["Kalibreringsexperimentet tas bort eller behålls", "Upplevs som tjat i intervjuerna", "Liten"],
  ], ["42%", "42%"])}</div>
  <div class="row cols-2 start">
    <div class="card"><h3>Intervjuguide, efter tentan</h3>${dots([
      "När och var pluggade du med Kuggfri, och hur länge åt gången?",
      "Vad fick dig att komma tillbaka, eller att sluta?",
      "Vilket läge använde du mest, och varför?",
      "Stämde det du kunde på tentan med det Kuggfri sa att du kunde?",
      "Vad skulle du ändra först?",
    ])}</div>
    ${callout("Så fattas beslutet vid G1", "green", dots([
      "Alvin sammanställer måtten och intervjuerna i rapporten efter kursomgången.",
      "Examinatorerna läser rapporten och säger om de vill fortsätta och rekommendera.",
      "Är H1 eller H2 långt från målet utreds orsaken innan fler kurser lovas.",
    ]))}
  </div>
  ${f(p, n)}`,

  // 7. Fas 2
  (p, n) => `${h()}
  ${phaseHead(2, "Grunden för fler kurser", "November 2026 till mars 2027, parallellt med slutet av fas 1", "Målet är att nästa kurs ska kunna starta utan att Alvin är flaskhalsen: driften ska kunna skötas av fler, innehållet ska kunna tas fram snabbare, och examinatorn ska klara mer själv.")}
  <div class="row cols-2 start">
    <div class="card"><h3>Förvaltningen</h3>${dots([
      "<b>En medförvaltare</b>, gärna en student från en senare årskull, som lär sig driften under ett år.",
      "<b>docs/DRIFT.md och en övad återställning</b> i Vercel och Supabase, fram och tillbaka, av någon annan än Alvin.",
      "<b>Säkerhetskopior på två ställen:</b> den nattliga lokala plus en krypterad kopia i molnet, med återställningstest varje månad.",
      "<b>Två administratörer</b> och hemligheter i ett delat lösenordsvalv, aldrig i en enskild persons huvud.",
      "<b>Systemöversikt i admin:</b> senaste nattjobbet, skickade mejl, fel och öppna felrapporter.",
    ])}</div>
    <div class="card"><h3>Plattformen</h3>${dots([
      "<b>Flera kurser för studenten:</b> en gemensam vy för i dag och en kalender över terminen.",
      "<b>Självbetjäning för examinatorn:</b> skapa kurs, import, bjud in kollegor, QR-kod för föreläsningen.",
      "<b>Rapporten efter kursomgången</b> som en knapp i admin, för examinatorns egen kursutveckling.",
      "<b>Tålighet:</b> lasttest med flera kurser samtidigt; cachen på publikt innehåll skalas med antalet kurser.",
      "<b>E-post:</b> DMARC och varumärkesverifiering hos Google, så att mejlen når fram när volymen växer.",
    ])}</div>
  </div>
  <div class="card"><h3>Innehållsmotorn, version 2</h3><p class="small" style="margin-bottom:5pt">Det största arbetet i fasen. Detaljerna står på sidan 10.</p>${dots([
    "<b>Utkast ur kursmaterialet</b> med sidhänvisning per påstående, i en kö för den oberoende kontrollen.",
    "<b>Kontrollen som eget verktyg:</b> varje påstående visas bredvid källans sida, med utfallen belagt, rättat eller struket.",
    "<b>Mätning av tid och kvalitet</b> per kurs, så att vi vet vad en ny kurs kostar i timmar innan vi lovar den.",
  ])}</div>
  <div class="card"><h3>Kostnader och planer</h3>${table(["Post", "I dag", "Att bestämma i fas 2"], [
    ["Webbdrift (Vercel)", "Hobby-planen, icke-kommersiell", "Betalplan om en organisation tar över eller trafiken kräver det"],
    ["Databas och inloggning (Supabase)", "Kontrollera aktuell plan", "Betalplan med dagliga kopior och återställning till tidpunkt"],
    ["E-post (Hostinger)", "Ingår i domänen", "Räcker volymen för fler kurser och veckobrev"],
    ["Domän och övrigt", "Liten årskostnad", "Vem som betalar på sikt"],
  ], ["30%", "30%"])}<p class="tiny muted" style="margin-top:4pt">Priser ändras; de kontrolleras när beslutet tas. Kostnaden bärs aldrig av studenterna.</p></div>
  ${gate("Klart när", ["En testkurs har gått från material till publicerat på under fyra veckor.", "Någon annan än Alvin har gjort en driftsättning och en återställning.", "Grind G2 är passerad."])}
  ${f(p, n)}`,

  // 8. Fas 3
  (p, n) => `${h()}
  ${phaseHead(3, "Tre till fem kurser", "Januari till juni 2027: LP3 och LP4", "Målet är att visa att modellen går att upprepa: fler kurser, fler examinatorer och samma kvalitet, utan att driften eller innehållet sviktar.")}
  <div class="row start" style="grid-template-columns:1.2fr 1fr">
    <div class="card"><h3>Så väljer vi pilotkurser</h3>${table(["Kriterium", "Varför"], [
      ["En examinator som vill", "Utan examinator ingen granskning och ingen kanal."],
      ["Begreppstung kurs", "Repetition gör mest för fakta och begrepp; rena räknekurser senare."],
      ["Material som går att källbelägga", "Föreläsningar, bok och gamla tentor med facit."],
      ["Stor kurs i tidig årskurs", "Fler studenter per granskningstimme, och en vana som följer med."],
      ["Samma program först", "Maskinteknik: studenterna känner redan Kuggfri."],
    ], ["40%"])}</div>
    <div class="card"><h3>Startmodellen: en kurs på fyra veckor</h3><table class="t">${[
      ["v. −4", "Samtal med examinatorn, tillgång till materialet, områdena fastställs."],
      ["v. −3", "Utkast ur materialet och oberoende kontroll."],
      ["v. −2", "Examinatorns granskning, med guiden. Tentadatum sätts."],
      ["v. −1", "Länk i Canvas, QR-bild till första föreläsningen, studentguiden."],
      ["v. 1", "Lansering i föreläsningen; daglig bevakning första veckan."],
      ["v. 2 och framåt", "Felrapporter, veckobrev, och retro efter tentan."],
    ].map(([w, d]) => `<tr><td class="n" style="width:22%">${w}</td><td>${d}</td></tr>`).join("")}</table></div>
  </div>
  <div class="row cols-3 start">
    ${callout("Föreslå ett kort", "green", `<p class="small">Studenter föreslår kort från passet; förslagen går genom samma kontroll och examinatorns granskning. Kvaliteten består, och innehållet växer.</p>`)}
    ${callout("Föreläsningsläget", "navy", `<p class="small">Bara om en examinator vill använda det i sal: fem till tio kort på projektorn, svar i mobilen, anonymt, utan poäng. Korten hamnar sedan i studenternas schema.</p>`)}
    ${callout("Fler kortformer", "teal", `<p class="small">Skriv svaret och lucktext, om fas 1 visat att examinatorerna saknar dem. Samma kort kan övas i flera former.</p>`)}
  </div>
  <div class="row cols-2 start">
    ${callout("När vi säger nej till en kurs", "teal", dots([
      "Examinatorn har inte tid att granska före kursstart: vi väntar en kursomgång.",
      "Materialet går inte att källbelägga, eller får inte användas.",
      "Driften klarar inte en kurs till just nu (principen driften före funktionerna).",
    ], "dont"))}
    ${callout("När en pilot avbryts", "navy", dots([
      "Under hälften av studenterna kommer tillbaka efter första veckan, trots åtgärder.",
      "Innehållsfel som inte hinner rättas inom en vecka.",
      "Examinatorn vill avsluta: innehållet exporteras och lämnas över, inget försvinner.",
    ]))}
  </div>
  ${gate("Klart när", ["Minst tre kurser har gått en hel läsperiod med granskat innehåll.", "Måtten håller i varje kurs, inte bara i Materialteknik.", "Examinatorernas granskningstid per kurs är under åtta timmar."])}
  ${f(p, n)}`,

  // 9. Fas 4
  (p, n) => `${h()}
  ${phaseHead(4, "Hemvist och fler program", "April till december 2027", "Målet är att Kuggfri inte längre hänger på en person: en organisation står bakom, driften är finansierad och tjänsten kan växa till fler program utan att löftet till studenterna ändras.")}
  <div class="card"><h3>Möjliga hemvister</h3>${table(["Alternativ", "Fördelar", "Nackdelar", "Passar när"], [
    ["Fortsatt ideellt, med medförvaltare", "Snabbt, fritt, inga avtal", "Sårbart, ingen finansiering", "Upp till ett fåtal kurser"],
    ["Förening eller studentkåren", "Kontinuitet mellan årskullar", "Begränsade resurser för drift", "Studentdrivet innehåll"],
    ["Institutionen eller programmet", "Nära examinatorerna, kan bära kostnaden", "Avtal och ansvar måste lösas", "Flera kurser inom samma institution"],
    ["Chalmers centralt", "Störst räckvidd, IT-stöd", "Långsamt, upphandling och policy", "Brett stöd från flera institutioner"],
  ], ["24%", "26%", "26%"])}</div>
  <div class="row cols-2 start">
    <div class="card"><h3>Det som måste lösas vid en ny hemvist</h3>${dots([
      "<b>Personuppgiftsansvaret</b> flyttas med tjänsten; en konsekvensbedömning görs när antalet studenter växer.",
      "<b>Avtal med examinatorerna</b> om innehållet: ägande, kreditering och vad som händer om en kurs avslutas.",
      "<b>Driftavtal och planer:</b> Vercels Hobby-plan gäller icke-kommersiell användning; en organisation kan behöva betalplaner.",
      "<b>Tillgänglighet och informationssäkerhet</b> enligt hemvistens krav, med den befintliga testningen som grund.",
    ])}</div>
    <div class="card"><h3>Vidare tillväxt</h3>${dots([
      "<b>Canvas:</b> först en länk och inbäddning, sedan en riktig integration om hemvisten vill.",
      "<b>Fler program</b> på Chalmers, i samma ordning: examinator, startmodell, grind.",
      "<b>Andra lärosäten</b> är ett alternativ först efter grind G3, och bara med samma löfte till studenterna.",
      "<b>Finansiering</b> ur hemvisten eller pedagogiska utvecklingsmedel, aldrig ur studenterna eller reklam.",
    ])}</div>
  </div>
  <div class="card"><h3>Frågor till en möjlig hemvist</h3><ol class="legend two" style="margin-top:3pt">${[
    "Vem blir personuppgiftsansvarig, och vem är kontaktperson?",
    "Vem betalar driften, och med vilken budget?",
    "Får tjänsten vara fri och gratis för alla studenter?",
    "Vem har sista ordet om innehållet: examinatorn eller hemvisten?",
    "Vilka krav på IT-säkerhet och tillgänglighet gäller?",
    "Hur länge åtar sig hemvisten tjänsten, och vad händer sedan?",
  ].map((t, i) => `<li>${num(i + 1)}<span>${t}</span></li>`).join("")}</ol></div>
  ${callout("Beslutet i juni 2027", "navy", `<p class="small">Vid grind G3 fattas ett beslut om hemvist, med de här alternativen som underlag och fas 3:s belägg som argument. Det viktigaste är att beslutet tas medan tjänsten går bra, inte när den ägaren som bär den ska lämna Chalmers.</p>`)}
  ${f(p, n)}`,

  // 10. Innehållsmotorn
  (p, n) => `${h()}
  ${title("Innehållsmotorn", "Innehållet är både Kuggfris största styrka och det som kostar mest att skala. Motorn ska göra en ny kurs billigare utan att källkritiken släpps (docs/KALLKRITIK.md).")}
  <div class="card">${pipeline()}<p class="tiny muted" style="margin-top:3pt">Den streckade pilen: felrapporter och genomgången efter tentan blir nya utkast, som går samma väg.</p></div>
  <div class="row cols-2 start">
    <div class="card"><h3>Roller</h3>${table(["Roll", "Ansvar"], [
      ["Redaktör", "Tar fram utkast ur materialet och sköter rättelser. I dag Alvin, framåt fler."],
      ["Kontrollant", "Prövar varje påstående mot källan, oberoende av den som skrev."],
      ["Examinator", "Godkänner, rättar eller tar ur rotation. Har sista ordet."],
      ["Studenterna", "Rapporterar fel och föreslår kort (fas 3)."],
    ], ["28%"])}</div>
    <div class="card"><h3>Tid och kvalitet per kurs</h3>${table(["Steg", "Riktmärke"], [
      ["Kort per kurs", "200 till 400"],
      ["Examinatorns granskning", "Cirka en minut per kort"],
      ["Andel flaggade vid kontrollen", "Omkring en fjärdedel i Materialteknik"],
      ["Rättelser efter lansering", "Under 3 per 100 kort"],
    ], ["55%"])}<p class="tiny muted" style="margin-top:4pt">Riktmärkena kommer från Materialteknik och skärps när fler kurser mätts.</p></div>
  </div>
  <div class="row cols-3 start">
    ${callout("AI som skrivhjälp", "green", `<p class="small">Utkast med sidhänvisning, distraktorer till flerval och översättningar. Bara kursens innehåll skickas, aldrig studentdata. Människan kontrollerar och beslutar alltid.</p>`)}
    ${callout("Upphovsrätt", "navy", `<p class="small">Egna formuleringar och egna diagram. Bokfigurer och tentafrågor bara med uttryckligt tillstånd från examinatorn, och med kreditering.</p>`)}
    ${callout("Varje år", "teal", `<p class="small">Efter tentan: kluriga kort och felrapporter ses över, kursändringar förs in och tentadatumet sätts för nästa kursomgång.</p>`)}
  </div>
  <div class="row cols-2 start">
    <div class="card"><h3>Återanvändning mellan kurser</h3>${dots([
      "Kurser som delar kursbok eller grundbegrepp kan dela kort, med varje examinators godkännande.",
      "Ett delat kort har en källa och en ägare; rättelser når alla kurser som använder det.",
      "Terminologin samlas i en ordlista per ämne, så att samma begrepp heter samma sak.",
    ])}</div>
    <div class="card"><h3>Kvalitetssignaler vi följer</h3>${dots([
      "Andel kort som flaggas vid kontrollen, per kurs och per redaktör.",
      "Felrapporter per 1 000 repetitioner, och hur många som ledde till en rättelse.",
      "Kort med ovanligt låg skattning: svåra, eller otydligt formulerade?",
    ])}</div>
  </div>
  ${f(p, n)}`,

  // 11. Risker
  (p, n) => `${h()}
  ${title("Risker och motåtgärder", "De tio största riskerna, med sannolikhet och konsekvens bedömda för läsåret 2026/27.")}
  <div class="card">${table(["Risk", "Sannolikhet", "Konsekvens", "Motåtgärd"], [
    ["Alvin blir otillgänglig (examen, sjukdom, tid)", "Hög på sikt", "Tjänsten stannar", "Medförvaltare, DRIFT.md, övad återställning, hemvist (fas&nbsp;2 och&nbsp;4)"],
    ["Fel i innehållet sprids", "Medel", "Förtroendet faller", "Källkritiken, examinatorns granskning, felrapporter inom 48&nbsp;h"],
    ["Låg användning efter första veckan", "Medel", "Inga belägg, ingen tillväxt", "Föreläsningen och Canvas som kanal; åtgärder efter H1 och H2"],
    ["En examinator slutar eller byts", "Medel", "Kursen saknar granskare", "Innehållet ägs av kursen och kan lämnas över; guiden gör starten enkel"],
    ["Dataförlust", "Låg", "Mycket allvarlig", "Säkerhetskopior på två ställen, månatligt återställningstest"],
    ["Ändrade villkor hos leverantörer", "Medel", "Kostnad eller avbrott", "Exporterbart innehåll, dokumenterad flytt, plan för betalplaner"],
    ["Juridik och personuppgifter vid skala", "Låg", "Tjänsten stoppas", "Minimal insamling, policyn alltid korrekt, konsekvensbedömning före bred spridning"],
    ["Upphovsrätt i kursmaterial", "Låg", "Kort måste tas bort", "Egna formuleringar, tillstånd för figurer och tentor"],
    ["Konkurrent med betald modell (t.ex. Kollin)", "Medel", "Studenter splittras", "Kursägt och granskat innehåll, gratis, examinatorns stöd"],
    ["Teknisk skuld bromsar fler kurser", "Medel", "Långsammare tillväxt", "Modulär innehållspipeline och tester; uppdelning av stora filer i fas&nbsp;2"],
  ].map((r, i) => [`${i + 1}. ${r[0]}`, ...r.slice(1)]), ["30%", "13%", "17%"])}</div>
  <div class="row start" style="grid-template-columns:1fr 1fr;align-items:center">
    <div class="card">${riskMatrix([[1, 2, 2], [2, 1, 2], [3, 1, 1], [4, 1, 1], [5, 0, 2], [6, 1, 1], [7, 0, 2], [8, 0, 0], [9, 1, 1], [10, 1, 0]])}</div>
    ${callout("Läs matrisen så här", "navy", dots([
      "Numren hänvisar till tabellen ovan.",
      "Uppe till höger: åtgärdas först. Risk 1, att allt hänger på Alvin, är den enda med både hög sannolikhet på sikt och hög konsekvens.",
      "Risk 5 och 7 är osannolika men allvarliga: de hanteras med rutiner, inte med tur.",
      "Matrisen ses över vid varje grind.",
    ]))}
  </div>
  ${f(p, n)}`,

  // 12. 90 dagar
  (p, n) => `${h()}
  ${title("De närmaste 90 dagarna", "Konkreta steg från mötet 2 oktober till januari 2027. Det mesta sker efter LP1-tentan, så att läsperioden får vara lugn.")}
  <div class="card"><table class="t">${[
    ["Oktober", "Granskningen till 0 kort, lansering, daglig bevakning första veckan. Studenttestet av skattningsskalan. Felrapporter inom 48 timmar."],
    ["Oktober", "Fråga om Kuggfri i kursutvärderingen, överenskommen med kursledningen."],
    ["Efter tentan", "Retro med Johan och Roland. Rapporten efter kursomgången (H1 till H5). Fem till tio studentintervjuer."],
    ["November", "Grind G1. Beslut om fas 2. Säkerhetskopior i molnet och en övad återställning."],
    ["November", "Hitta en medförvaltare. Samtal med en eller två examinatorer om LP3 och LP4."],
    ["December", "Innehållsmotorn version 2 påbörjas, med en testkurs. Systemöversikten i admin."],
    ["Januari", "Grind G2. Första pilotkursen enligt startmodellen, om en examinator har tackat ja."],
  ].map(([w, d]) => `<tr><td class="n" style="width:16%">${w}</td><td>${d}</td></tr>`).join("")}</table></div>
  <div class="row cols-2 start">
    ${callout("Beslut som behövs från Alvin", "green", dots([
      "Vem som tillfrågas som medförvaltare, och när.",
      "Vilka examinatorer som kontaktas inför LP3 och LP4.",
      "Om AI-utkast ska användas i innehållsmotorn, och med vilka gränser.",
      "Hur långt den här planen ska delas: bara internt, eller med kursledningen.",
    ]))}
    ${callout("Det som inte får glömmas", "navy", dots([
      "Ingen migration samma dag som en föreläsning.",
      "Integritetspolicyn uppdateras vid varje ny uppgift som sparas.",
      "Varje ny kurs startar med granskat innehåll, aldrig utkast.",
      "Planen ses över vid varje grind; den är ett verktyg, inte ett löfte.",
    ]))}
  </div>
  <div><h2>Om ett år, om planen lyckas</h2></div>
  ${T.tiles([
    ["Kurser", "3–5", "med granskat innehåll och nöjda examinatorer", "green"],
    ["Förvaltare", "2+", "och en dokumenterad, övad drift", "navy"],
    ["Belägg", "1 rapport", "per kursomgång, med måtten och studenternas röst", "teal"],
    ["Hemvist", "Beslutad", "så att Kuggfri finns kvar efter Alvin", "violet"],
  ])}
  <p class="small muted">Löftet är detsamma som i dag: gratis, kursägt, källgranskat och utan spårning. Det som har ändrats är att fler kurser får det, och att det inte längre hänger på en person.</p>
  ${f(p, n)}`,
];

async function bygg(skrivUt) {
  await skrivUt({
    name: "framtidsplan",
    html: T.documentHtml({ htmlDir: DIR, title: "Framtidsplan för Kuggfri", pages: PAGES }),
    htmlFile: path.join(DIR, "framtidsplan.html"),
    pdfFile: path.join(T.ROOT, "docs", "Framtidsplan.pdf"),
  });
}

module.exports = { bygg };
