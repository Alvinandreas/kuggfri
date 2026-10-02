/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Granskningsguiderna för examinatorerna: svenska (Johan, områdena 1–11) och engelska (Roland,
 * områdena 12–14). Tre A4-sidor var i ljust tema. Skärmbilderna tas med
 * scripts/pdf/skarmbilder-granskning.cjs och ligger i docs/granskningsguide/bilder/.
 *
 *   node scripts/pdf/bygg.cjs granskningsguide
 *
 * Tema, komponenter och regler: scripts/pdf/tema.cjs och docs/Designsystem.pdf.
 */
const path = require("path");
const T = require("./tema.cjs");
const { btn } = T;

const DIR = path.join(T.ROOT, "docs/granskningsguide");

function pages(t) {
  const h = () => T.header(DIR, { eyebrow: t.eyebrow, meta: t.course });
  const f = (p, n) => T.footer(DIR, { left: t.footer, page: p, pages: n, lang: t.lang });
  const keysHalf = Math.ceil(t.keys.length / 2);
  return [
    (p, n) => `${h()}
  <h1>${t.h1}</h1>
  <p class="lead">${t.lead}</p>
  ${T.tiles(t.tiles)}
  <h2>${t.startTitle}</h2>
  ${T.steps(t.steps)}
  <h2>${t.windowTitle}</h2>
  <div class="shot crop" style="aspect-ratio:2560/1085"><img src="bilder/${t.lang}-fonster.png" alt=""></div>
  ${T.legend(t.windowLegend, true)}
  ${f(p, n)}`,
    (p, n) => `${h()}
  <div><h2>${t.cardTitle}</h2><p class="lead" style="margin-top:3pt">${t.cardLead}</p></div>
  <div class="split">
    <div class="shot"><img src="bilder/${t.lang}-kort.png" alt=""></div>
    <div>${T.legend(t.cardLegend)}</div>
  </div>
  <h2>${t.decisionsTitle}</h2>
  <div class="decisions">${t.decisions.map(([b, d]) => `<div class="decision"><div class="head">${b}</div><p>${d}</p></div>`).join("")}</div>
  <div class="row start" style="grid-template-columns:1.2fr 1fr">
    <div class="card"><h3>${t.keysTitle}</h3>${t.keysNote ? `<p class="small muted" style="margin-bottom:2pt">${t.keysNote}</p>` : ""}<table class="keys">${t.keys.slice(0, keysHalf).map(([k, d], i) => { const r = t.keys[i + keysHalf]; return `<tr><td class="k">${k}</td><td>${d}</td>${r ? `<td class="k" style="padding-left:8mm">${r[0]}</td><td>${r[1]}</td>` : "<td></td><td></td>"}</tr>`; }).join("")}</table></div>
    ${T.callout(t.savedTitle, "green", T.dots(t.saved))}
  </div>
  ${f(p, n)}`,
    (p, n) => `${h()}
  ${t.page3}
  ${f(p, n)}`,
  ];
}

// ---------------------------------------------------------------- Svenska (Johan, områdena 1–11)
const sv = {
  lang: "sv",
  title: "Granskningsguide Materialteknik",
  eyebrow: "Granskningsguide för examinatorer",
  course: "Materialteknik MTT085, områdena 1–11",
  h1: "Så granskar du korten i Materialteknik",
  lead: "Alla 405 kort ligger i rotation, och tjänsten öppnar för studenterna när varje kort är granskat. <strong>Din del är metallerna, områdena 1–11.</strong>",
  tiles: [
    ["Dina kort", "297", "i områdena 1–11", "green"],
    ["Flaggade", "87", "av Kuggfris källgranskning", "navy"],
    ["Tidsåtgång", "ca 5 h", "en knapp minut per kort", "teal"],
    ["Sparas", "Direkt", "dela gärna upp arbetet", "violet"],
  ],
  startTitle: "Kom igång",
  steps: [
    ["Öppna länken", "Öppna länken från Alvin i webbläsaren. Den släpper in dig i en vecka medan tjänsten är stängd för studenterna."],
    ["Skapa konto", "Välj Skapa konto med adressen som Alvin har lagt in, och bekräfta via mejlet. Rättigheterna kopplas automatiskt."],
    ["Öppna Granskning", "I sidomenyn, under Administration, väljer du Granskning. Siffran bredvid är antalet kort som återstår."],
    ["Välj område och börja", "Välj ett av dina områden i filtret Område och tryck Börja granska. Sedan tar du korten ett i taget."],
  ],
  windowTitle: "Granskningssidan",
  windowLegend: [
    "<b>Granskning</b> i sidomenyn, med antalet kort som återstår.",
    "<b>Granskningsöversikt</b>: hur stor del av kursen som är granskad, och hur många kort som är flaggade.",
    "<b>Flikarna</b> Att granska, Granskade, Flaggade och Ur rotation. Ett flaggat kort finns både under Att granska och Flaggade.",
    "<b>Filter</b>: välj ditt område under Område. Sökrutan söker i fråga, svar och källa.",
    "<b>Områdena</b> fälls ut med ett klick. Stapeln visar hur långt granskningen har kommit i varje område.",
    "<b>Börja granska</b> öppnar första kortet i den filtrerade listan.",
  ],
  cardTitle: "Ett kort i taget",
  cardLead: "Kortet visas som studenten ser det, med rätt svar markerat. Frågan att ställa sig är den som står överst: stämmer innehållet, och är det formulerat som du vill ha det?",
  cardLegend: [
    "<b>Bläddra</b> mellan korten med pilarna, eller med <kbd>J</kbd> och <kbd>K</kbd>. <b>Till listan</b> tar dig tillbaka.",
    "<b>Område, uppgiftstyp och källor</b>. Raden under säger om kortet är nytt, ett originalkort från tidigare årskullar eller en rättad version av ett originalkort.",
    "<b>Fråga och svar</b>, som studenten ser dem. Svarsalternativen är markerade som rätt eller fel.",
    "<b>Källor</b> fälls ut och visar exakt vilken föreläsning, sida eller uppgift kortet bygger på.",
    "<b>Åtgärdsraden</b> med dina beslut. Bokstaven på varje knapp är kortkommandot.",
  ],
  decisionsTitle: "Fyra beslut",
  decisions: [
    [btn("✓ Godkänn", "G", "primary"), "Kortet stämmer och är formulerat som du vill. Det flyttas till Granskade och ligger kvar i rotation."],
    [btn("Redigera", "R"), "Rätta texten, svarsalternativen, ledtråden eller området direkt. <b>Spara och godkänn</b> sparar och godkänner i samma steg."],
    [btn("Flagga", "F"), "Något behöver ändras och du vill att vi gör det. Skriv vad i rutan och tryck Enter. Vi rättar kortet, och det kommer tillbaka till dig för godkännande."],
    [btn("Ta ur rotation", "T"), "Kortet hör inte hemma i kursen. Studenterna ser det inte, och det hamnar under Ur rotation, där det kan sättas tillbaka."],
  ],
  keysTitle: "Kortkommandon",
  keys: [
    ["<kbd>G</kbd>", "Godkänn"],
    ["<kbd>R</kbd>", "Redigera"],
    ["<kbd>F</kbd>", "Flagga"],
    ["<kbd>T</kbd>", "Ta ur rotation"],
    ["<kbd>J</kbd> <kbd>→</kbd>", "Nästa"],
    ["<kbd>K</kbd> <kbd>←</kbd>", "Föregående"],
    ["<kbd>Esc</kbd>", "Till listan"],
    ["<kbd>Ctrl</kbd> <kbd>Z</kbd>", "Ångra"],
  ],
  savedTitle: "Bra att veta",
  saved: [
    "Varje beslut sparas direkt och tar dig till nästa kort. Du kan sluta när som helst och fortsätta senare.",
    "Ångra med <kbd>Ctrl</kbd> <kbd>Z</kbd> eller med Ångra i rutan efter beslutet.",
    "Ändra dig i efterhand: öppna kortet under Granskade eller Ur rotation och tryck <b>Markera som ogranskad</b> (<kbd>O</kbd>).",
    "Ändras ett godkänt kort hamnar det under Att granska igen.",
  ],
  page3: `
  <div><h2>Flaggade kort från Kuggfris källgranskning</h2>
  <p class="lead" style="margin-top:3pt">Innan granskningen har varje kort kontrollerats mot kursens eget material: föreläsningar, GLU, labb-PM, gamla tentor och kurslitteratur. Där källorna inte stämmer överens, eller där vi har rättat ett originalkort, har kortet fått en flagga med en anteckning om vad som hittades och vilket beslut som behövs. <strong>87 av dina kort är flaggade.</strong></p></div>
  <div class="shot croptop" style="aspect-ratio:2288/1100"><img src="bilder/sv-flaggat.png" alt=""></div>
  <div class="row cols-2" style="align-items:start">
    <div class="card"><h3>Så hanterar du en flagga</h3>
      <ul class="acts">
        <li>${btn("✓ Godkänn och ta bort flaggan", "G", "primary")}<span>Kortet stämmer som det står nu. Flaggan försvinner och kortet är granskat.</span></li>
        <li>${btn("Redigera", "R")}<span>Formulera om kortet själv och tryck sedan <b>Spara och godkänn</b>.</span></li>
        <li>${btn("Återställ originalet")}<span>Finns under <b>…</b> på rättade originalkort, när du hellre vill ha originalets lydelse än vår rättelse. Originalet blir godkänt.</span></li>
        <li>${btn("Åtgärdad", "", "outline")}<span>Tar bara bort flaggan. Kortet ligger kvar under Att granska.</span></li>
        <li>${btn("Ändra anteckningen")}<span>Svara oss i anteckningen med ditt beslut eller din fråga, så tar vi det därifrån.</span></li>
      </ul>
    </div>
    <div style="display:grid;gap:3.5mm">
      <div class="card"><h3>Flagga själv</h3>
        <p class="small muted" style="margin-bottom:6pt">Tryck <kbd>F</kbd>, skriv vad som behöver åtgärdas och tryck Enter. Du går direkt vidare till nästa kort.</p>
        <div class="shot"><img src="bilder/sv-flaggpanel.png" alt=""></div>
      </div>
      <div class="callout"><h3><span class="dot d-teal"></span>Ett förslag på arbetsgång</h3>
        <ul class="dots">
          <li>Ta ett område i taget: välj det under Område och tryck Börja granska.</li>
          <li>Godkänn det som stämmer direkt, så går de flesta kort fort.</li>
          <li>Är du osäker, flagga hellre än att lämna kortet. Då ser vi frågan.</li>
        </ul>
      </div>
    </div>
  </div>`,
  footer: "Frågor? Alvin, alvinan@chalmers.se",
};

// ---------------------------------------------------------------- English (Roland, topics 12–14)
const en = {
  lang: "en",
  title: "Review guide Materialteknik",
  eyebrow: "Review guide for examiners",
  course: "Materialteknik MTT085, topics 12–14",
  h1: "How to review the cards in Materialteknik",
  lead: "All 405 cards are in rotation, and the service opens to students once every card has been reviewed. <strong>Your part is the polymers, topics 12–14.</strong>",
  tiles: [
    ["Your cards", "108", "in topics 12–14", "green"],
    ["Flagged", "16", "by Kuggfri’s source check", "navy"],
    ["Time needed", "about 2 h", "roughly a minute per card", "teal"],
    ["Saved", "Instantly", "split the work as you like", "violet"],
  ],
  startTitle: "Getting started",
  steps: [
    ["Open the link", "Open the link from Alvin in your browser. It lets you in for a week while the service is closed to students."],
    ["Create an account", "Sign-in is in Swedish: choose <b>Skapa konto</b> (Create account) with the address Alvin registered, and confirm by email."],
    ["Switch to English", "Click your name at the bottom left, choose <b>Konto</b> (Account) and pick <b>English</b> under <b>Språk</b>. It applies everywhere you sign in."],
    ["Open Review", "In the sidebar, under Administration, choose <b>Review</b>. Pick a topic under <b>Topic</b> and press <b>Start reviewing</b>."],
  ],
  windowTitle: "The review page",
  windowLegend: [
    "<b>Review</b> in the sidebar, with the number of cards left.",
    "<b>Review overview</b>: how much of the course has been reviewed, and how many cards are flagged.",
    "<b>The tabs</b> To review, Reviewed, Flagged and Removed. A flagged card appears under both To review and Flagged.",
    "<b>Filters</b>: choose your topic under Topic. The search box searches question, answer and source.",
    "<b>The topics</b> expand with a click. The bar shows how far the review has come in each topic.",
    "<b>Start reviewing</b> opens the first card in the filtered list.",
  ],
  cardTitle: "One card at a time",
  cardLead: "The card is shown the way the student sees it, with the correct answer marked. The question to ask is the one at the top: is the content correct, and is it phrased the way you want?",
  cardLegend: [
    "<b>Move</b> between cards with the arrows, or with <kbd>J</kbd> and <kbd>K</kbd>. <b>Back to list</b> takes you back.",
    "<b>Topic, question type and sources</b>. The line below says whether the card is new, an original card from earlier cohorts or a corrected original.",
    "<b>Show Swedish</b> shows the text the students actually see. A warning appears here if the Swedish card has changed since it was translated.",
    "<b>Question and answer</b>, as the student sees them. Answer options are marked correct or wrong.",
    "<b>Sources</b> expands to show exactly which lecture, page or exercise the card is based on.",
    "<b>The action bar</b> with your decisions. The letter on each button is its keyboard shortcut.",
  ],
  decisionsTitle: "Four decisions",
  decisions: [
    [btn("✓ Approve", "G", "primary"), "The card is correct and phrased the way you want. It moves to Reviewed and stays in rotation."],
    [btn("Flag", "F"), "Something needs to change. Write what in English and press Enter. We fix the Swedish card and its translation, and it comes back to you for approval."],
    [btn("Remove from rotation", "T"), "The card does not belong in the course. Students no longer see it, and it moves to Removed, where it can be put back."],
    [btn("Edit", "R"), "Opens the card’s Swedish text for editing. For wording changes, flagging with an English note is usually easier: we make the change in both languages."],
  ],
  keysTitle: "Keyboard shortcuts",
  keysNote: "The letters come from the Swedish button names (G for Godkänn), so they are the same in both languages.",
  keys: [
    ["<kbd>G</kbd>", "Approve"],
    ["<kbd>F</kbd>", "Flag"],
    ["<kbd>T</kbd>", "Remove from rotation"],
    ["<kbd>R</kbd>", "Edit"],
    ["<kbd>J</kbd> <kbd>→</kbd>", "Next"],
    ["<kbd>K</kbd> <kbd>←</kbd>", "Previous"],
    ["<kbd>Esc</kbd>", "Back to list"],
    ["<kbd>Ctrl</kbd> <kbd>Z</kbd>", "Undo"],
  ],
  savedTitle: "Good to know",
  saved: [
    "Every decision is saved immediately and takes you to the next card. You can stop at any time and continue later.",
    "Undo with <kbd>Ctrl</kbd> <kbd>Z</kbd>, or with Undo in the message after each decision.",
    "Changed your mind? Open the card under Reviewed or Removed and press <b>Mark as unreviewed</b> (<kbd>O</kbd>).",
    "If an approved card is changed, it returns to To review.",
  ],
  page3: `
  <div><h2>Flagged cards from Kuggfri’s source check</h2>
  <p class="lead" style="margin-top:3pt">Before the review, every card was checked against the course’s own material: lectures, lab instructions, old exams and the course literature. Where the sources disagree, or where we have corrected an original card, the card carries a flag with a note on what was found and which decision is needed. <strong>16 of your cards are flagged.</strong> They are listed under both To review and Flagged, with the note shown above the card.</p></div>
  <div class="row cols-2" style="align-items:start">
    <div class="card"><h3>Dealing with a flag</h3>
      <ul class="acts">
        <li>${btn("✓ Approve and remove the flag", "G", "primary")}<span>The card is correct as it stands. The flag disappears and the card counts as reviewed.</span></li>
        <li>${btn("Restore the original")}<span>Under <b>…</b> on corrected original cards, when you prefer the original wording to our correction. The original is then approved.</span></li>
        <li>${btn("Resolved", "", "outline")}<span>Only removes the flag. The card stays under To review.</span></li>
        <li>${btn("Change the note")}<span>Answer us in the note with your decision or your question, in English, and we take it from there.</span></li>
        <li>${btn("Remove from rotation", "T")}<span>If the card should not be in the course at all.</span></li>
      </ul>
    </div>
    <div style="display:grid;gap:3.5mm">
      <div class="card"><h3>Flagging a card yourself</h3>
        <p class="small muted" style="margin-bottom:6pt">Press <kbd>F</kbd>, write what needs to be fixed and press Enter. You move straight on to the next card.</p>
        <div class="shot"><img src="bilder/en-flaggpanel.png" alt=""></div>
      </div>
      <div class="card"><h3>Where the cards end up</h3>
        <table class="t">
          <tr><td class="n">To review</td><td>Cards nobody has approved yet, flagged ones included.</td></tr>
          <tr><td class="n">Reviewed</td><td>Approved cards, most recently reviewed first, with who approved them and when.</td></tr>
          <tr><td class="n">Flagged</td><td>All cards with a flag, until the flag is resolved.</td></tr>
          <tr><td class="n">Removed</td><td>Cards taken out of rotation. Students do not see them.</td></tr>
        </table>
      </div>
    </div>
  </div>
  <div class="row cols-2" style="align-items:start">
    <div class="callout"><h3><span class="dot d-navy"></span>Working in English</h3>
      <ul class="dots">
        <li>The translations follow the terminology of your lectures and the course literature.</li>
        <li>Students study the Swedish cards. <b>Show Swedish</b> on each card shows exactly what they see.</li>
        <li>If a translation reads oddly, flag the card and tell us. That is useful too.</li>
      </ul>
    </div>
    <div class="callout"><h3><span class="dot d-teal"></span>A suggested way of working</h3>
      <ul class="dots">
        <li>Take one topic at a time: choose it under Topic and press Start reviewing.</li>
        <li>Approve what is correct right away; most cards go quickly.</li>
        <li>When in doubt, flag rather than skip. Then we see the question.</li>
      </ul>
    </div>
  </div>`,
  footer: "Questions? Alvin, alvinan@chalmers.se",
};

const DOCS = [
  { t: sv, name: "granskningsguide-sv" },
  { t: en, name: "review-guide-en" },
];

/** Bygger båda guiderna; används av scripts/pdf/bygg.cjs. */
async function bygg(skrivUt) {
  for (const { t, name } of DOCS) {
    await skrivUt({
      name,
      html: T.documentHtml({ htmlDir: DIR, title: t.title, lang: t.lang, pages: pages(t) }),
      htmlFile: path.join(DIR, `${name}.html`),
      pdfFile: path.join(T.ROOT, "docs", `${name}.pdf`),
    });
  }
}

module.exports = { bygg };
