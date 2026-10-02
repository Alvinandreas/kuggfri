/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Alvins eget underlag inför mötet 2 okt 2026: morgonens checklista, demons manus, troliga frågor
 * med svar, och vad som avgör Kuggfris framtid. Inte för utdelning.
 *
 *   npm run pdf -- infor-motet
 */
const path = require("path");
const T = require("./tema.cjs");
const { callout, dots, num } = T;

const DIR = path.join(T.ROOT, "docs/infor-motet");
const h = () => T.header(DIR, { eyebrow: "Inför mötet 2 oktober", meta: "Ditt eget underlag, inte för utdelning" });
const f = (p, n) => T.footer(DIR, { left: "Kuggfri", page: p, pages: n });

const demo = [
  ["Hem", "Logga in på kuggfri.com. Hälsningen, dagens pass, inlärd kunskap och radarn. Säg: schemat väljer korten, studenten behöver inte planera."],
  ["Ett pass", "Fortsätt plugga och Starta. Ett vändkort: svara i huvudet, vänd, skatta. En flervalsfråga: rättas direkt, med förklaring."],
  ["Efter passet", "Sammanfattningen: siffrorna, Plugga vidare och korten som behöver mest arbete. Avsluta med krysset."],
  ["Ett område", "Klicka på ett område i radarn: plugga bara det, schemalagt, kluriga kort eller dugga."],
  ["Min statistik", "Aktivitetskartan, utvecklingen och milstolparna. Bara studentens egna siffror."],
  ["Granskningen", "Granskning: välj ett område, Börja granska. Ett vanligt kort och ett flaggat från källgranskningen. Visa knapparna, men tryck inte G (se nedan)."],
  ["Engelska", "Konto, Språk, English: granskningen och flaggan på engelska. För Roland. Byt tillbaka efteråt."],
  ["Kursöversikten", "Lokalt på 3001 med de simulerade studenterna. Säg tydligt att siffrorna är simulerade."],
];

const qa = [
  ["Vem äger innehållet?", "Kursen. Allt kan exporteras som en fil när som helst (Innehåll, Exportera JSON), och korten versionshanteras."],
  ["Vad kostar det kursen?", "Ingenting. Drift och underhåll står Kuggfri för. Studenterna betalar inget och ser ingen reklam."],
  ["Hur är det med GDPR?", "Bara namn, e-post och studieprogress, inom EU. Ingen spårning. Studenten laddar ner och raderar allt själv. Integritetspolicyn på sajten beskriver exakt vad som sparas."],
  ["Vad ser examinatorn om enskilda studenter?", "Inget. Bara sammanställd statistik, och per område eller kort först när minst fem studenter skattat."],
  ["Hur vet vi att korten stämmer?", "Varje kort är kontrollerat mot kursens material och har källa. 103 kort flaggades där källorna skiljer sig åt. Examinatorerna granskar allt innan kursen öppnar."],
  ["Hittar en student ett fel?", "Flaggan i passet skickar en felrapport till examinatorn, med kortet bifogat. Rättelser syns direkt."],
  ["Hur lång tid tar granskningen?", "Ungefär en minut per kort: cirka 5 timmar för Johan och 2 för Roland, i så många pass de vill."],
  ["Ersätter det något i kursen?", "Nej, det är ett komplement: repetition av det som tas upp i föreläsningarna, med kursens egna begrepp."],
  ["Hjälper det verkligen?", "Framplockning och utspridd repetition är de två studieteknikerna med starkast stöd i forskningen (Dunlosky m.fl. 2013). Effekten på just den här kursen vet vi först efter en kursomgång; föreslå en fråga i kursutvärderingen."],
  ["Kan studenterna plugga på engelska?", "Ja, under Konto. Den granskade texten är den svenska; engelskan är en översättning som kontrollerats mot kursens terminologi."],
  ["Gamla tentor?", "Tentaläget har kursens gamla tentor med skrivtid, poäng och facit. Det är låst tills examinatorn vill öppna det."],
  ["Vad händer när du tar examen?", "Se sidan 3. Ha ett ärligt svar: allt är dokumenterat och exporterbart, och du vill hitta en långsiktig hemvist."],
];

const PAGES = [
  // 1. Checklista och demo
  (p, n) => `${h()}
  <h1>Inför mötet</h1>
  <p class="lead">Läget i produktionen klockan 04 i natt: <strong>405 kort i rotation, alla översatta, 103 flaggor med engelska anteckningar, 0 granskade.</strong> Tjänsten är stängd för utomstående bakom grinden.</p>
  <div class="row start" style="grid-template-columns:1fr 1.25fr">
    <div class="card"><h3>Checklista i morgon bitti</h3>
      <ol class="legend" style="margin-top:3pt">${[
        "<b>Byt språk till Svenska</b> under Konto på ditt eget konto. Det står på engelska sedan du provade språkvalet.",
        "<b>Öppna länken med förhandsnyckeln</b> i webbläsaren du demar i, och logga in.",
        "<b>Examinatorer:</b> kontrollera att både Johan och Roland står under Inställningar. Just nu finns en examinator och en väntande inbjudan.",
        "<b>3001 för översikten:</b> Docker och lokala Supabase igång, starta förhandsvisningen kuggfri-3001 (eller be Claude).",
        "<b>PDF:erna öppna</b> lokalt ifall nätet strular: guiderna, studentguiden och mötesunderlaget i docs/.",
        "<b>Mejlet till Johan och Roland</b> förberett: länken, deras guide och mötesunderlaget.",
      ].map((t, i) => `<li>${num(i + 1)}<span>${t}</span></li>`).join("")}</ol>
    </div>
    <div class="card"><h3>Demon, cirka 10 minuter</h3>
      <table class="t">${demo.map(([t, d], i) => `<tr><td style="width:1%;padding-right:7pt">${num(i + 1)}</td><td><b>${t}</b><br><span class="small muted">${d}</span></td></tr>`).join("")}</table>
    </div>
  </div>
  <div class="row cols-2 start">
    ${callout("Granskningen är skarp", "teal", dots([
      "Det du godkänner, flaggar eller tar ur rotation i demon sparas på riktigt.",
      "Visa knapparna utan att trycka, eller ångra direkt med Ctrl+Z.",
      "Bäst: låt Johan eller Roland själva godkänna sitt första kort.",
    ], "dont"))}
    ${callout("Bra att säga högt", "green", dots([
      "Kursen öppnar först när granskningen visar 0 kort kvar.",
      "Statistiken i översikten är simulerad; riktiga siffror kommer när studenterna börjar.",
      "Allt de ser i dag finns beskrivet i deras guide.",
    ]))}
  </div>
  ${f(p, n)}`,

  // 2. Frågor och svar
  (p, n) => `${h()}
  <div><h2>Troliga frågor, med svar</h2><p class="lead" style="margin-top:3pt">Korta svar som stämmer med hur tjänsten fungerar i dag. Är du osäker på något: säg att du återkommer, hellre än att lova.</p></div>
  <div class="card"><table class="t">${qa.map(([q, a]) => `<tr><td class="n" style="width:33%">${q}</td><td>${a}</td></tr>`).join("")}</table></div>
  ${callout("Det du vill gå därifrån med", "green", dots([
    "Granskningsplanen: vem tar vilka områden, och klart senast vilket datum.",
    "Ett lanseringsdatum, eller åtminstone en vecka.",
    "Tentadatumet, och beslut om värdena som skiljer sig mellan källorna (723 eller 727 °C, 0,8 eller 0,77 % C).",
    "Ett ja till att länken läggs i Canvas och nämns i en föreläsning.",
  ]))}
  ${f(p, n)}`,

  // 3. Framtiden
  (p, n) => `${h()}
  <div><h2>Det som avgör om Kuggfri lever vidare</h2><p class="lead" style="margin-top:3pt">Tjänsten är i gott skick. Det som hotar den på sikt är inte tekniken utan att den hänger på en person. Mötet är ett bra tillfälle att börja lösa det.</p></div>
  <div class="row cols-2 start">
    <div class="card"><h3>Risker att ta på allvar</h3><ul class="acts">
      <li><b>En person bär allt.</b><span class="small">Drift, innehåll och kod hänger på dig. Dokumentationen finns (deploy, återställning, innehåll), men ingen annan har övat den.</span></li>
      <li><b>Säkerhetskopiorna ligger på din dator.</b><span class="small">De körs varje natt men bara när datorn är på, och finns bara där. En kopia på ett andra ställe behövs.</span></li>
      <li><b>Gratisplanerna har villkor.</b><span class="small">Vercels Hobby-plan gäller icke-kommersiell användning. Ligger Supabase på gratisplanen pausas projekt utan aktivitet; det dagliga jobbet håller det vid liv, men det är värt att veta.</span></li>
      <li><b>Innehållet åldras.</b><span class="small">Kursen ändras mellan åren. Utan en rutin efter varje tentaperiod blir korten gradvis fel.</span></li>
    </ul></div>
    <div class="card"><h3>Det som stärker framtidsutsikterna</h3><ul class="acts">
      <li><b>En hemvist.</b><span class="small">Fråga om institutionen, programmet eller Chalmers pedagogiska stöd kan stå bakom tjänsten, så att den inte försvinner med dig.</span></li>
      <li><b>Belägg för att det hjälper.</b><span class="small">En fråga i kursutvärderingen och anonym användningsstatistik efter tentan. Det är det som övertygar nästa kurs.</span></li>
      <li><b>Fler kurser.</b><span class="small">Examinatorer rekommenderar till kollegor. Infobladet och självbetjäningen gör nästa kurs billig att starta.</span></li>
      <li><b>En medförvaltare.</b><span class="small">En student från nästa årskull som lär sig driften med dig under ett år.</span></li>
    </ul></div>
  </div>
  <div class="card"><h3>Att be om på mötet, om stämningen är rätt</h3>
    <ol class="legend two" style="margin-top:3pt">${[
      "En fråga om Kuggfri i årets kursutvärdering.",
      "Att få nämna eller länka Kuggfri i kurs-PM och på Canvas inför nästa år.",
      "Namn på en eller två kollegor med kurser där det skulle passa.",
      "Vem på institutionen som är rätt person att prata långsiktig hemvist med.",
      "En kort genomgång efter tentan: kluriga kort och felrapporter, som underlag för nästa år.",
      "Om de vill stå som examinatorer för innehållet även nästa läsår.",
    ].map((t, i) => `<li>${num(i + 1)}<span>${t}</span></li>`).join("")}</ol>
  </div>
  ${callout("Efter lanseringen, på tekniksidan", "navy", dots([
    "Säkerhetskopior även utanför din dator, till exempel en krypterad kopia i molnet.",
    "Återställningsövningen i Vercel och docs/DRIFT.md, så att någon annan kan ta över driften.",
    "DMARC för mejlen och Googles varumärkesverifiering, enligt TASKS.md.",
  ]))}
  ${f(p, n)}`,
];

async function bygg(skrivUt) {
  await skrivUt({
    name: "infor-motet",
    html: T.documentHtml({ htmlDir: DIR, title: "Inför mötet 2 oktober", pages: PAGES }),
    htmlFile: path.join(DIR, "infor-motet.html"),
    pdfFile: path.join(T.ROOT, "docs", "Infor-motet-2-okt.pdf"),
  });
}

module.exports = { bygg };
