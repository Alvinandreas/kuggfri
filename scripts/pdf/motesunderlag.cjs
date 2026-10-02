/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Mötesunderlaget till mötet 2 okt 2026 med kursledningen och båda examinatorerna (Johan, metallerna;
 * Roland Kádár, polymererna). På engelska, eftersom Roland inte läser svenska.
 *
 *   npm run pdf -- motesunderlag
 *
 * Siffrorna är produktionens läge 2 okt (405 kort, 103 flaggor, 0 granskade). Lanseringsdatumet är
 * ett förslag att besluta om på mötet.
 */
const path = require("path");
const T = require("./tema.cjs");
const { callout, dots, num } = T;

const DIR = path.join(T.ROOT, "docs/motesunderlag");
const h = () => T.header(DIR, { eyebrow: "Meeting, 2 October 2026", meta: "Kuggfri for Materialteknik MTT085" });
const f = (p, n) => T.footer(DIR, { left: "Alvin, alvinan@chalmers.se", page: p, pages: n, lang: "en" });

// Produktionen 2 okt: [område, kort, flaggade]
const TOPICS = [
  ["Material groups and properties", 24, 5], ["The materials selection process", 27, 6], ["Crystal structure", 28, 6],
  ["Phase diagrams and microstructure", 45, 14], ["Stiffness and elastic deformation", 21, 5], ["Plasticity, dislocations and hardening", 24, 3],
  ["Fracture and fatigue", 30, 10], ["Thermal properties, diffusion and creep", 29, 15], ["Steel, heat treatment and processing", 36, 12],
  ["Non-ferrous metals", 17, 4], ["Sustainability and recycling", 16, 7], ["Structure of Polymers", 37, 7],
  ["Polymer melt rheology and processing", 44, 4], ["Mechanical properties of polymers", 27, 5],
];

const agendaRow = (n, title, min, body) =>
  `<tr><td style="width:1%;padding-right:8pt">${num(n)}</td><td><b>${title}</b><br><span class="small muted">${body}</span></td><td style="text-align:right;white-space:nowrap" class="muted">${min} min</td></tr>`;

const PAGES = [
  // 1. Läget och dagordningen
  (p, n) => `${h()}
  <h1>Kuggfri for Materialteknik</h1>
  <p class="lead">Every card is now in rotation and waiting for your review. The service opens to students <strong>once every card has been reviewed</strong>. Today we agree on who reviews what, by when, and the launch date.</p>
  ${T.tiles([
    ["Cards", "405", "in 14 topics, all in rotation", "green"],
    ["Flagged", "103", "by Kuggfri’s source check", "navy"],
    ["Reviewed", "0", "the review starts after today", "teal"],
    ["Review time", "about 7 h", "5 h for Johan, 2 h for Roland", "violet"],
  ])}
  <h2>Agenda</h2>
  <div class="card"><table class="t">
    ${agendaRow(1, "Where we are", 5, "The course content since the first version: 144 cards became 405, every card checked against the course material, with sources.")}
    ${agendaRow(2, "Demo: the student’s view", 10, "Home page, today’s session, a card, the summary and My statistics.")}
    ${agendaRow(3, "Demo: the review", 10, "The review page, one card at a time, the four decisions, flags and the English switch.")}
    ${agendaRow(4, "Review plan and launch date", 15, "Who reviews which topics, by when, and the date the course opens to students.")}
    ${agendaRow(5, "Decisions and open questions", 15, "The exam date, values that differ between sources, and the questions on page 3.")}
    ${agendaRow(6, "Next steps", 5, "Who does what after the meeting.")}
  </table></div>
  <div class="row cols-2 start">
    ${callout("Demo order", "green", dots([
      "Student view on kuggfri.com, with Alvin’s own study history.",
      "The review on kuggfri.com, as an examiner sees it, in Swedish and English.",
      "The course overview locally, with <b>simulated</b> students, to show the statistics examiners will get.",
    ]))}
    ${callout("Handed out today", "navy", dots([
      "Review guide in Swedish (Johan) and English (Roland), three pages each.",
      "Student guide, eight pages, sent with the launch announcement.",
      "The link to the service, sent by Alvin by email.",
    ]))}
  </div>
  ${f(p, n)}`,

  // 2. Granskningsplanen och lanseringen
  (p, n) => `${h()}
  <div><h2>Review plan</h2><p class="lead" style="margin-top:3pt">Each examiner reviews their own part. A card is done when it is approved or removed from rotation, and a flag is done when it is resolved.</p></div>
  <div class="row cols-2">
    <div class="tile"><div class="k">${T.dot("green")}Johan Ahlström, metals</div><div class="v">297 cards</div><div class="l">topics 1–11, of which 87 flagged. About 5 hours.</div></div>
    <div class="tile"><div class="k">${T.dot("navy")}Roland Kádár, polymers</div><div class="v">108 cards</div><div class="l">topics 12–14, of which 16 flagged, all with English notes. About 2 hours.</div></div>
  </div>
  <div class="card"><table class="t bars">
    <tr><th>Topic</th><th>Cards</th><th>Flagged</th><th></th><th style="text-align:right">Reviewer</th></tr>
    ${TOPICS.map(([name, cards, flagged], i) => `<tr><td style="white-space:nowrap"><span style="display:inline-flex;align-items:center;gap:5pt"><span class="n" style="width:13pt;height:13pt;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:6.6pt;font-weight:700;background:${T.tagVar(i)}">${i + 1}</span>${name}</span></td><td class="muted">${cards}</td><td class="muted">${flagged}</td><td class="bar">${T.shareBar([{ value: flagged, tone: "chart-3", label: "Flagged" }, { value: cards - flagged, tone: "surface-3", label: "Other" }], { height: "4pt", legendItems: false })}</td><td style="text-align:right" class="muted">${i < 11 ? "Johan" : "Roland"}</td></tr>`).join("")}
  </table></div>
  <div class="row start" style="grid-template-columns:1.15fr 1fr">
    <div class="card"><h3>Proposed timeline, to decide today</h3><table class="t">
      <tr><td class="n">Today, 2 Oct</td><td>Review guides and the link go out. Both examiners create their accounts.</td></tr>
      <tr><td class="n">By Fri 9 Oct</td><td>Johan and Roland have reviewed their topics. Alvin fixes flagged cards within a day.</td></tr>
      <tr><td class="n">Mon 12 Oct</td><td>Last check, then the course opens to students and the student guide is sent out.</td></tr>
    </table><p class="tiny muted" style="margin-top:4pt">The dates are a proposal. The service opens only when the review shows 0 cards left.</p></div>
    ${callout("What makes the review quick", "green", dots([
      "One card at a time, with keyboard shortcuts: G approves.",
      "Every decision saves at once; it can be split over several sittings.",
      "A flag with a short note is enough: Alvin makes the change and it comes back for approval.",
    ]))}
  </div>
  ${f(p, n)}`,

  // 3. Beslut och frågor
  (p, n) => `${h()}
  <div><h2>Decisions and open questions</h2><p class="lead" style="margin-top:3pt">The answers settle many flags at once and let the review go faster.</p></div>
  <div class="card"><table class="t">
    <tr><th style="width:4%"></th><th style="width:42%">Question</th><th>Why it matters</th></tr>
    <tr><td>${num(1)}</td><td class="n">The exam date for MTT085</td><td>The schedule plans towards it: every card in time, nothing pushed past the exam, a final review the last days.</td></tr>
    <tr><td>${num(2)}</td><td class="n">Which values should the course use?</td><td>The sources differ: 723 or 727 °C, 0.8 or 0.77 % C for the eutectoid point, and 910, 912 or 913 °C. One decision settles 6 flags and all Fe–C cards.</td></tr>
    <tr><td>${num(3)}</td><td class="n">Cards that follow old exam questions closely: keep or rewrite?</td><td>6 flags ask whether a card is too close to an exam question or its suggested solution.</td></tr>
    <tr><td>${num(4)}</td><td class="n">Is the Boltzmann superposition principle part of this year’s course? <span class="muted" style="font-weight:400">(Roland)</span></td><td>It is not in the reading instructions for PM 6 in 2024 and 2025. Two cards depend on it.</td></tr>
    <tr><td>${num(5)}</td><td class="n">May figures from the course books (Ashby, Osswald) be used in cards?</td><td>Otherwise only our own redrawn diagrams.</td></tr>
    <tr><td>${num(6)}</td><td class="n">Weekly summary by email? <span class="muted" style="font-weight:400">(Johan)</span></td><td>Monday mornings: active students, hardest topics, tricky questions and error reports. Anonymous.</td></tr>
  </table></div>
  <div class="row cols-2 start">
    ${callout("Found in the 2025 material on Canvas", "teal", `<p class="small" style="margin-bottom:4pt">The same errors were corrected in the cards. Should the slides be updated too?</p>${dots([
      "Lecture 9 p. 7: the K1c condition.",
      "Lecture 12 p. 22: tempered martensite.",
      "Lecture 13 p. 13: titanium as the only biocompatible metal.",
      "GLU 5-8 p. 15: about 30 % primary ferrite, where the lever rule gives about 60 %.",
    ])}`)}
    ${callout("For Roland", "navy", dots([
      "Errors in old suggested solutions: the pressure build-up zone in the extruder (IMS085 2023-10-25 p. 6) and “ejection unit” (2021).",
      "The order of the necking stages: Lecture 21 p. 14 versus L6 p. 10.",
      "Swedish term choices for metering zone, die swell and holding pressure.",
    ]))}
  </div>
  <div class="row cols-3 start">
    ${callout("32 corrected originals", "green", `<p class="small">Original cards from earlier cohorts that the source check corrected. Each can be approved or restored to the original wording.</p>`)}
    ${callout("Your own feedback", "violet", `<p class="small">On the content, the study modes and the review. Anything you want changed before launch.</p>`)}
    ${callout("After the meeting", "navy", `<p class="small">Alvin makes the agreed changes, sends the guides and the link, and follows the review until 0 cards are left.</p>`)}
  </div>
  ${f(p, n)}`,
];

async function bygg(skrivUt) {
  await skrivUt({
    name: "motesunderlag",
    html: T.documentHtml({ htmlDir: DIR, title: "Meeting 2 October 2026", lang: "en", pages: PAGES }),
    htmlFile: path.join(DIR, "motesunderlag.html"),
    pdfFile: path.join(T.ROOT, "docs", "Motesunderlag-2-okt.pdf"),
  });
}

module.exports = { bygg };
