/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Kuggfris PDF-tema: samma tokens som app/globals.css, komponenter och diagram som HTML/SVG-strängar.
 * Allt ritas med CSS-variabler, så samma diagram fungerar i ljust tema (standard) och i mörkt tema
 * (klassen "dark" på <body> eller på ett omslutande element). Beskrivs i docs/Designsystem.pdf.
 *
 * Används av scripts/pdf/granskningsguide.cjs och scripts/pdf/designsystem.cjs; skrivs ut av
 * scripts/pdf/skriv-ut.cjs. Ren CommonJS utan beroenden, så att det går att köra med node direkt.
 */
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

// ---------------------------------------------------------------------------------------------
// Tokens (app/globals.css). "page" är PDF-sidans bakgrund: vit i ljust tema, duken i mörkt.
// ---------------------------------------------------------------------------------------------

const TAGS_LIGHT = [20, 62, 95, 140, 175, 215, 255, 290, 325, 355].map((h, i) => `oklch(0.9 ${i === 0 ? "0.07" : i === 1 ? "0.08" : "0.10"} ${h})`);
const TAGS_DARK = [20, 62, 95, 140, 175, 215, 255, 290, 325, 355].map((h, i) => `oklch(0.44 ${i === 0 ? "0.09" : i === 1 ? "0.10" : "0.13"} ${h})`);

const LIGHT = {
  page: "#ffffff", bg: "#f6f5f1", sidebar: "#efede8", surface: "#ffffff", "surface-2": "#eeece6", "surface-3": "#e4e1da",
  fg: "#1d1c19", muted: "#676259", subtle: "#68635a", line: "#dedbd3", "line-strong": "#c4c0b6",
  accent: "#1f7a4d", "accent-hover": "#196540", "accent-fg": "#ffffff", "accent-soft": "#dcefe3", "accent-ink": "#17613d",
  danger: "#a13d3d", "danger-soft": "#f6e6e6", inverse: "#1d1c19", "inverse-fg": "#ffffff",
  "chart-1": "#1f7a4d", "chart-2": "#3b6ea5", "chart-3": "#c97a1f", "chart-4": "#7657b3", "chart-grid": "#e6e3dc",
  "rate-1": "#b0523f", "rate-2": "#b9773a", "rate-3": "#a3953a", "rate-4": "#6d9a4a", "rate-5": "#3f8b5c",
  "shadow-card": "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.06)",
  ...Object.fromEntries(TAGS_LIGHT.map((v, i) => [`tag-${i + 1}`, v])),
};

const DARK = {
  page: "#101111", bg: "#101111", sidebar: "#161717", surface: "#1c1d1d", "surface-2": "#252626", "surface-3": "#2f3030",
  fg: "#f1f1ee", muted: "#a8a8a2", subtle: "#98988f", line: "#28292a", "line-strong": "#3b3c3c",
  accent: "#3fb872", "accent-hover": "#55c886", "accent-fg": "#06140c", "accent-soft": "#173121", "accent-ink": "#5fcf8e",
  danger: "#e0827c", "danger-soft": "#3a2322", inverse: "#f1f1ee", "inverse-fg": "#121313",
  "chart-1": "#3fb872", "chart-2": "#4f86c9", "chart-3": "#cf7f22", "chart-4": "#a48ae0", "chart-grid": "#2c2d2d",
  "rate-1": "#c9705d", "rate-2": "#cf9455", "rate-3": "#bfb15a", "rate-4": "#8ab56b", "rate-5": "#62a97c",
  "shadow-card": "0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px rgb(0 0 0 / 0.35)",
  ...Object.fromEntries(TAGS_DARK.map((v, i) => [`tag-${i + 1}`, v])),
};

const vars = (t) => Object.entries(t).map(([k, v]) => `--${k}: ${v};`).join(" ");

/** Relativ sökväg från HTML-filens mapp till en fil i repot (typsnitt, logotyper, skärmbilder). */
function asset(htmlDir, rel) {
  return path.relative(htmlDir, path.join(ROOT, rel)).split(path.sep).join("/");
}

// ---------------------------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------------------------

function css(htmlDir) {
  const font = (f) => asset(htmlDir, `node_modules/@fontsource-variable/figtree/files/${f}`);
  return `
@font-face { font-family: "Figtree"; font-weight: 300 900; font-style: normal; font-display: block;
  src: url("${font("figtree-latin-wght-normal.woff2")}") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: "Figtree"; font-weight: 300 900; font-style: normal; font-display: block;
  src: url("${font("figtree-latin-ext-wght-normal.woff2")}") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
:root { ${vars(LIGHT)} --radius-md: 12px; --radius-lg: 20px; --radius-tile: 14px; }
.dark { ${vars(DARK)} }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--page); color: var(--fg); font-family: "Figtree", ui-sans-serif, system-ui, sans-serif;
  font-size: 9.6pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-variant-numeric: tabular-nums; }
.dark { color: var(--fg); }

/* Sidmall: A4, 13/14/10 mm marginal, en kolumn med 4,2 mm mellanrum; sidfoten nederst. */
.page { width: 210mm; height: 297mm; padding: 13mm 14mm 10mm; display: flex; flex-direction: column; gap: 4.2mm; background: var(--page); overflow: hidden; break-after: page; }
.page:last-child { break-after: auto; }
.page > * { flex: none; }
header.top { display: flex; align-items: center; justify-content: space-between; gap: 8mm; }
header.top img { height: 11mm; width: auto; display: block; }
header.top .meta { text-align: right; }
.eyebrow { font-size: 7.6pt; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
header.top .meta .course { font-size: 9.5pt; font-weight: 600; color: var(--muted); margin-top: 1pt; }
.foot { margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: 3mm; border-top: 1px solid var(--line); font-size: 8.6pt; color: var(--muted); }
.foot img { height: 6.5mm; width: auto; }
.foot .url { color: var(--accent); font-weight: 750; }

/* Typografi */
h1 { font-size: 25pt; line-height: 1.08; letter-spacing: -0.02em; margin: 0; font-weight: 800; }
h2 { font-size: 14.5pt; line-height: 1.2; letter-spacing: -0.01em; margin: 0; font-weight: 800; }
h3 { font-size: 10.6pt; margin: 0 0 2.5pt; font-weight: 750; }
p { margin: 0 0 4pt; } p:last-child { margin-bottom: 0; }
.lead { font-size: 11.2pt; line-height: 1.5; color: var(--muted); max-width: 165mm; }
.lead strong { color: var(--fg); }
.muted { color: var(--muted); }
.small { font-size: 8.8pt; }
.tiny { font-size: 7.8pt; }
.mono { font-family: ui-monospace, Consolas, monospace; font-size: 8pt; }
code { font-family: ui-monospace, Consolas, monospace; font-size: 0.86em; background: var(--surface-2); border-radius: 4pt; padding: 0.5pt 3pt; }

/* Rutnät */
.row { display: grid; gap: 3.5mm; }
.cols-2 { grid-template-columns: 1fr 1fr; } .cols-3 { grid-template-columns: repeat(3, 1fr); } .cols-4 { grid-template-columns: repeat(4, 1fr); }
.split { display: grid; grid-template-columns: 1.15fr 1fr; gap: 6mm; align-items: start; }
.start { align-items: start; }

/* Nyckeltal som StatTile (components/stats/StatTile.tsx): grå yta, färgprick, stort värde. */
.tile { background: var(--surface-2); border-radius: var(--radius-tile); padding: 10pt 12pt 11pt; }
.tile .k { display: flex; align-items: center; gap: 5pt; font-size: 8pt; font-weight: 600; color: var(--muted); }
.tile .v { margin-top: 7pt; font-size: 21pt; font-weight: 800; line-height: 1; letter-spacing: -0.02em; white-space: nowrap; }
.tile .l { margin-top: 5pt; font-size: 8pt; line-height: 1.35; color: var(--muted); }
.dot { width: 5.5pt; height: 5.5pt; border-radius: 50%; flex: none; display: inline-block; }
.d-green { background: var(--chart-1); } .d-navy { background: var(--chart-2); } .d-teal { background: var(--chart-3); } .d-violet { background: var(--chart-4); }

/* Block */
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); padding: 10pt 12pt; }
.dark .card { border-color: transparent; }
.callout { border-radius: var(--radius-md); padding: 9pt 11pt; background: var(--surface-2); }
.callout h3 { margin-bottom: 3pt; display: flex; align-items: center; gap: 5pt; }
.steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3.5mm; margin: 0; padding: 0; list-style: none; }
.steps li { background: var(--surface-2); border-radius: var(--radius-md); padding: 8pt 10pt; }
.steps .num { margin-bottom: 3pt; }
.steps p { font-size: 8.7pt; line-height: 1.42; color: color-mix(in oklab, var(--fg) 82%, transparent); }
.num { display: inline-flex; width: 17pt; height: 17pt; border-radius: 50%; background: var(--accent); color: var(--accent-fg); font-weight: 800; font-size: 9pt; align-items: center; justify-content: center; flex: none; }
.decisions { display: grid; grid-template-columns: 1fr 1fr; gap: 3.5mm; }
.decision { border-radius: var(--radius-md); padding: 9pt 11pt; background: var(--surface-2); }
.decision .head { display: flex; align-items: center; gap: 6pt; margin-bottom: 3pt; }
.decision p { font-size: 8.8pt; line-height: 1.42; color: color-mix(in oklab, var(--fg) 82%, transparent); }

/* Knappar och tangenter */
.btn { display: inline-flex; align-items: center; gap: 5pt; border-radius: 999px; padding: 3pt 9pt; font-weight: 750; font-size: 9pt; background: var(--surface-3); color: var(--fg); white-space: nowrap; }
.btn.primary { background: var(--accent); color: var(--accent-fg); }
.btn.outline { background: var(--surface); border: 1px solid var(--line-strong); }
kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 13pt; height: 13pt; padding: 0 3pt; border-radius: 4pt;
  border: 1px solid color-mix(in oklab, currentColor 30%, transparent); font: 700 7.2pt/1 ui-monospace, Consolas, monospace; }
.btn kbd { opacity: 0.8; }

/* Listor och tabeller */
.legend { display: grid; gap: 3pt 6mm; margin: 0; padding: 0; list-style: none; }
.legend.two { grid-template-columns: 1fr 1fr; }
.legend li { display: flex; gap: 6pt; align-items: flex-start; font-size: 8.9pt; line-height: 1.4; }
.legend .num { width: 14pt; height: 14pt; font-size: 7.6pt; margin-top: 0.5pt; }
.legend b { font-weight: 750; }
ul.dots { margin: 0; padding: 0; list-style: none; display: grid; gap: 3.2pt; }
ul.dots li { position: relative; padding-left: 11pt; font-size: 9pt; line-height: 1.42; }
ul.dots li::before { content: ""; position: absolute; left: 0; top: 0.52em; width: 5pt; height: 5pt; border-radius: 50%; background: var(--accent); }
ul.dots.dont li::before { background: var(--danger); }
ul.acts { margin: 0; padding: 0; list-style: none; }
ul.acts li { display: grid; justify-items: start; gap: 3pt; padding: 6pt 0; border-bottom: 1px solid var(--line); font-size: 9pt; line-height: 1.42; }
ul.acts li:last-child { border-bottom: 0; padding-bottom: 0; }
ul.acts li:first-child { padding-top: 2pt; }
table.t { width: 100%; border-collapse: collapse; font-size: 8.8pt; }
table.t th { text-align: left; font-size: 7.4pt; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 700; padding: 0 8pt 4pt 0; border-bottom: 1px solid var(--line); }
table.t td { padding: 4pt 8pt 4pt 0; border-bottom: 1px solid var(--line); vertical-align: top; }
table.t tr:last-child td { border-bottom: 0; }
table.t td.n { white-space: nowrap; font-weight: 750; }
table.keys { width: 100%; border-collapse: collapse; font-size: 9pt; }
table.keys td { padding: 3.6pt 0; border-bottom: 1px solid var(--line); vertical-align: middle; }
table.keys tr:last-child td { border-bottom: 0; }
table.keys td.k { width: 1%; white-space: nowrap; padding-right: 8pt; } table.keys td.k kbd { margin-right: 2pt; }

/* Skärmbilder */
.shot { border-radius: var(--radius-md); border: 1px solid var(--line); box-shadow: var(--shadow-card); overflow: hidden; background: var(--bg); }
.shot img { display: block; width: 100%; height: auto; }
.shot.crop img, .shot.croptop img { height: 100%; object-fit: cover; object-position: top left; }
.shot.croptop img { object-position: bottom left; }

/* Mobilskärmbild: rundad ram som en telefon */
.phone { border-radius: 16pt; border: 1px solid var(--line-strong); box-shadow: var(--shadow-card); overflow: hidden; background: var(--bg); }
.phone img { display: block; width: 100%; height: auto; }
.phonecap { text-align: center; font-size: 8pt; color: var(--muted); margin-top: 4pt; }

/* Skattningsskalan: siffran i skalans färg */
.rate { display: inline-flex; width: 17pt; height: 17pt; border-radius: 6pt; align-items: center; justify-content: center; font-weight: 800; font-size: 9pt; flex: none;
  border: 1.5px solid currentColor; }
.rate-1 { color: var(--rate-1); background: color-mix(in oklab, var(--rate-1) 14%, var(--surface)); }
.rate-2 { color: var(--rate-2); background: color-mix(in oklab, var(--rate-2) 14%, var(--surface)); }
.rate-3 { color: var(--rate-3); background: color-mix(in oklab, var(--rate-3) 14%, var(--surface)); }
.rate-4 { color: var(--rate-4); background: color-mix(in oklab, var(--rate-4) 14%, var(--surface)); }
.rate-5 { color: var(--rate-5); background: color-mix(in oklab, var(--rate-5) 14%, var(--surface)); }
.qr { width: 100%; max-width: 34mm; display: block; }
.qr svg { width: 100%; height: auto; display: block; }

/* Diagram */
.chart { display: block; width: 100%; height: auto; overflow: visible; }
.chart text { font-family: "Figtree", sans-serif; font-variant-numeric: tabular-nums; }
.chart-legend { display: flex; flex-wrap: wrap; gap: 3pt 10pt; font-size: 7.8pt; color: var(--muted); margin-top: 5pt; }
.chart-legend span { display: inline-flex; align-items: center; gap: 4pt; }
.chart-legend b { color: var(--fg); font-weight: 700; }
.swatch { width: 10pt; height: 3pt; border-radius: 2pt; display: inline-block; }
.sharebar { display: flex; overflow: hidden; border-radius: 999px; background: var(--surface-3); }
.sharebar > div { height: 100%; }
.areabars { display: grid; gap: 4.5pt; font-size: 8.2pt; }
.areabars .r { display: grid; grid-template-columns: 13pt minmax(0, 1fr) 24pt; gap: 3pt 6pt; align-items: center; }
.areabars .n { width: 13pt; height: 13pt; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 6.6pt; font-weight: 700; color: var(--fg); }
.areabars .lbl { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.areabars .pct { text-align: right; color: var(--muted); }
.areabars .bar { grid-column: 2 / 4; height: 4.5pt; border-radius: 999px; background: var(--surface-3); display: flex; overflow: hidden; }
.radarlist { display: grid; grid-template-columns: 1fr 1fr; grid-auto-flow: column; gap: 2.5pt 8pt; margin: 0; padding: 0; list-style: none; font-size: 7.8pt; }
.radarlist li { display: flex; align-items: center; gap: 4pt; min-width: 0; }
.radarlist .n { width: 11pt; height: 11pt; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 6pt; font-weight: 700; flex: none; }
.radarlist .lbl { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.radarlist .pct { color: var(--muted); }

/* Prov i mörkt tema inne i en ljus sida */
.panel { border-radius: var(--radius-md); padding: 9pt 11pt; background: var(--page); border: 1px solid var(--line); }
.dark.panel { background: var(--bg); border-color: var(--bg); }
.panel .cap { font-size: 7.2pt; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 6pt; display: flex; justify-content: space-between; }
.swatches { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2.5mm; }
.sw { border-radius: 9pt; overflow: hidden; border: 1px solid var(--line); font-size: 7pt; }
.sw .c { height: 12mm; }
.sw .t { padding: 3pt 5pt 4pt; background: var(--surface); }
.sw .t b { display: block; font-size: 7.4pt; color: var(--fg); }
.sw .t span { color: var(--muted); font-family: ui-monospace, Consolas, monospace; font-size: 6.6pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.progress { height: 6pt; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.progress > div { height: 100%; background: var(--chart-1); border-radius: 999px; }
table.bars td { vertical-align: middle; }
table.bars td.bar { width: 34%; }
.chartblock h3 { margin-bottom: 0; }
.chartblock .sub { font-size: 8pt; color: var(--muted); margin: 1pt 0 6pt; }
.chartblock .src { font-size: 7.2pt; color: var(--muted); margin-top: 5pt; }
td code, li code { white-space: nowrap; }
`;
}

// ---------------------------------------------------------------------------------------------
// Komponenter
// ---------------------------------------------------------------------------------------------

const num = (n) => `<span class="num">${n}</span>`;
const dot = (tone) => `<span class="dot d-${tone}"></span>`;
const btn = (label, key, kind = "") => `<span class="btn ${kind}">${label}${key ? ` <kbd>${key}</kbd>` : ""}</span>`;
const legend = (items, two = false) => `<ol class="legend${two ? " two" : ""}">${items.map((t, i) => `<li>${num(i + 1)}<span>${t}</span></li>`).join("")}</ol>`;
const tile = ([label, value, sub, tone]) => `<div class="tile"><div class="k">${dot(tone)}${label}</div><div class="v">${value}</div><div class="l">${sub}</div></div>`;
const tiles = (list) => `<div class="row cols-${list.length}">${list.map(tile).join("")}</div>`;
const steps = (list) => `<ol class="steps">${list.map(([h, p], i) => `<li>${num(i + 1)}<h3>${h}</h3><p>${p}</p></li>`).join("")}</ol>`;
const callout = (title, tone, body) => `<div class="callout"><h3>${tone ? dot(tone) : ""}${title}</h3>${body}</div>`;
const dots = (items, cls = "") => `<ul class="dots ${cls}">${items.map((s) => `<li>${s}</li>`).join("")}</ul>`;

/** Sidhuvud: logotypen till vänster, överrubrik och metarad till höger. dark: logotypen för mörkt tema. */
function header(htmlDir, { eyebrow, meta, dark = false }) {
  return `<header class="top"><img src="${asset(htmlDir, `public/logo-${dark ? "dark" : "light"}.png`)}" alt="Kuggfri"><div class="meta"><div class="eyebrow">${eyebrow}</div><div class="course">${meta}</div></div></header>`;
}

/** Sidfot: liten logotyp, kontaktrad, kuggfri.com och sidnumret. */
function footer(htmlDir, { left, page, pages, lang = "sv", dark = false }) {
  const of = lang === "en" ? `Page ${page} of ${pages}` : `Sida ${page} av ${pages}`;
  return `<div class="foot"><img src="${asset(htmlDir, `public/logo-menu-${dark ? "dark" : "light"}.png`)}" alt=""><span>${left} &nbsp; <span class="url">kuggfri.com</span> &nbsp; ${of}</span></div>`;
}

/** Ett helt dokument: varje sida är en funktion som får sitt sidnummer. */
function documentHtml({ htmlDir, title, lang = "sv", dark = false, pages }) {
  const body = pages.map((fn, i) => `<section class="page">${fn(i + 1, pages.length)}</section>`).join("\n");
  return `<!doctype html>\n<html lang="${lang}">\n<head><meta charset="utf-8"><title>${title}</title><style>${css(htmlDir)}</style></head>\n<body${dark ? ' class="dark"' : ""}>\n${body}\n</body>\n</html>\n`;
}

// ---------------------------------------------------------------------------------------------
// Tal
// ---------------------------------------------------------------------------------------------

/** Svenska: decimalkomma och "37 %"; engelska: decimalpunkt och "37%". */
const fmt = (n, lang = "sv", digits = 0) => {
  const s = Number(n).toFixed(digits);
  return lang === "sv" ? s.replace(".", ",") : s;
};
const pct = (n, lang = "sv") => (lang === "sv" ? `${Math.round(n)} %` : `${Math.round(n)}%`);

/** "Snygga" skalsteg: 0 till max med högst ~4 steg om 1, 2, 2,5 eller 5 gånger en tiopotens. */
function ticks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const out = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(+v.toFixed(6));
  if (out[out.length - 1] < max) out.push(+(out[out.length - 1] + step).toFixed(6));
  return out;
}

/** Etikett på var labelEvery:e punkt och alltid den sista, men inte en som står för nära den sista. */
const showLabel = (i, n, every) => i === n - 1 || (i % every === 0 && n - 1 - i >= Math.ceil(every / 2));

const tagVar = (i) => `var(--tag-${(((i % 10) + 10) % 10) + 1})`;

// ---------------------------------------------------------------------------------------------
// Diagram (SVG). Mått i viewBox-enheter; diagrammet skalar till kolumnens bredd.
// ---------------------------------------------------------------------------------------------

/** Andelsstapel (ReviewBar i granskningen, framsteg): segment som andelar, rund ände. */
function shareBar(segments, { height = "6pt", legendItems = null, lang = "sv" } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const bar = `<div class="sharebar" style="height:${height}">${segments.map((s) => (s.value ? `<div style="width:${(s.value / total) * 100}%;background:var(--${s.tone})${s.opacity ? `;opacity:${s.opacity}` : ""}"></div>` : "")).join("")}</div>`;
  const leg = legendItems === false ? "" : `<div class="chart-legend">${segments.map((s) => `<span><span class="dot" style="background:var(--${s.tone})${s.opacity ? `;opacity:${s.opacity}` : ""}"></span>${s.label} <b>${fmt(s.value, lang)}</b></span>`).join("")}</div>`;
  return bar + leg;
}

/** Stapeldiagram, lodrätt (BarChart.tsx). values: tal, eller listor för staplade staplar (tones per lager). */
function barChart({ labels, values, tones = ["chart-1"], labelEvery = 1, w = 440, h = 210, highlight = null, valueOnTop = false, lang = "sv" }) {
  const PAD = { top: 12, right: 8, bottom: 26, left: 30 };
  const stacks = values.map((v) => (Array.isArray(v) ? v : [v]));
  const max = Math.max(...stacks.map((s) => s.reduce((a, b) => a + b, 0)));
  const tk = ticks(max);
  const top = tk[tk.length - 1];
  const innerW = w - PAD.left - PAD.right, innerH = h - PAD.top - PAD.bottom;
  const y = (v) => PAD.top + innerH - (v / top) * innerH;
  const slot = innerW / stacks.length, barW = Math.min(28, slot * 0.62);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">`;
  for (const t of tk) s += `<line x1="${PAD.left}" x2="${w - PAD.right}" y1="${y(t)}" y2="${y(t)}" stroke="var(--chart-grid)" stroke-width="1"/><text x="${PAD.left - 6}" y="${y(t) + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${fmt(t, lang, t % 1 ? 1 : 0)}</text>`;
  stacks.forEach((st, i) => {
    const x = PAD.left + i * slot + (slot - barW) / 2;
    let acc = 0;
    st.forEach((v, j) => {
      if (!v) return;
      const y0 = y(acc), y1 = y(acc + v);
      const tone = highlight === i && st.length === 1 ? "accent-hover" : tones[j % tones.length];
      const last = j === st.length - 1;
      s += last ? `<path d="M${x} ${y0} V${y1 + 4} Q${x} ${y1} ${x + 4} ${y1} H${x + barW - 4} Q${x + barW} ${y1} ${x + barW} ${y1 + 4} V${y0} Z" fill="var(--${tone})"/>` : `<rect x="${x}" y="${y1}" width="${barW}" height="${y0 - y1}" fill="var(--${tone})"/>`;
      acc += v;
    });
    if (valueOnTop) s += `<text x="${x + barW / 2}" y="${y(acc) - 4}" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--fg)">${fmt(acc, lang)}</text>`;
    if (showLabel(i, stacks.length, labelEvery)) s += `<text x="${x + barW / 2}" y="${h - 8}" text-anchor="${i === stacks.length - 1 && labelEvery > 1 ? "end" : "middle"}" font-size="10" fill="var(--muted)">${labels[i]}</text>`;
  });
  return s + `<line x1="${PAD.left}" x2="${w - PAD.right}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line-strong)" stroke-width="1"/></svg>`;
}

/** Linjediagram (LineChart.tsx): 1 till 3 serier, yta under första serien, slutvärdet utskrivet. */
function lineChart({ labels, series, labelEvery = 1, w = 440, h = 210, lang = "sv", unit = "" }) {
  const PAD = { top: 14, right: 34, bottom: 26, left: 30 };
  const max = Math.max(...series.flatMap((s) => s.values));
  const tk = ticks(max);
  const top = tk[tk.length - 1];
  const n = labels.length;
  const innerW = w - PAD.left - PAD.right, innerH = h - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => PAD.top + innerH - (v / top) * innerH;
  const path = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">`;
  for (const t of tk) s += `<line x1="${PAD.left}" x2="${w - PAD.right}" y1="${y(t)}" y2="${y(t)}" stroke="var(--chart-grid)" stroke-width="1"/><text x="${PAD.left - 6}" y="${y(t) + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${fmt(t, lang, t % 1 ? 1 : 0)}</text>`;
  labels.forEach((l, i) => {
    if (showLabel(i, n, labelEvery)) s += `<text x="${x(i)}" y="${h - 8}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}" font-size="10" fill="var(--muted)">${l}</text>`;
  });
  series.forEach((sr) => {
    if (sr.area) s += `<path d="${path(sr.values)} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z" fill="var(--${sr.tone})" fill-opacity="0.12"/>`;
  });
  series.forEach((sr) => {
    const last = sr.values[n - 1];
    s += `<path d="${path(sr.values)}" fill="none" stroke="var(--${sr.tone})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${sr.dashed ? ' stroke-dasharray="4 3"' : ""}/>`;
    s += `<circle cx="${x(n - 1)}" cy="${y(last)}" r="3.5" fill="var(--${sr.tone})" stroke="var(--page)" stroke-width="1.5"/>`;
    s += `<text x="${x(n - 1) + 7}" y="${y(last) + 3.5}" font-size="10" font-weight="700" fill="var(--${sr.tone})">${fmt(last, lang)}${unit}</text>`;
  });
  return s + "</svg>";
}

/** Radardiagram (RadarChart.tsx): inlärda fyllt, delvis inlärda som ljus yta, numrerade områden. */
function radarChart(axes, { size = 260 } = {}) {
  const C = size / 2, R = size * 0.385, LR = R + 16;
  const n = axes.length;
  const ang = (i) => (i / n) * Math.PI * 2;
  const polar = (a, r) => [C + Math.sin(a) * r, C - Math.cos(a) * r];
  const pts = (f) => axes.map((a, i) => polar(ang(i), R * f(a)));
  const poly = (p) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  let s = `<svg class="chart" viewBox="0 0 ${size} ${size}" role="img">`;
  for (const f of [0.25, 0.5, 0.75, 1]) s += `<polygon points="${poly(axes.map((_, i) => polar(ang(i), R * f)))}" fill="none" stroke="var(--chart-grid)" stroke-width="1"/>`;
  axes.forEach((_, i) => { const [x, y] = polar(ang(i), R); s += `<line x1="${C}" y1="${C}" x2="${x}" y2="${y}" stroke="var(--chart-grid)" stroke-width="1"/>`; });
  s += `<polygon points="${poly(pts((a) => (a.learned + a.partial) / a.total))}" fill="var(--chart-1)" fill-opacity="0.07" stroke="var(--chart-1)" stroke-opacity="0.35" stroke-width="1.5" stroke-linejoin="round"/>`;
  const lp = pts((a) => a.learned / a.total);
  s += `<polygon points="${poly(lp)}" fill="var(--chart-1)" fill-opacity="0.6" stroke="var(--chart-1)" stroke-width="2" stroke-linejoin="round"/>`;
  axes.forEach((a, i) => {
    const [px, py] = lp[i];
    const [lx, ly] = polar(ang(i), LR);
    s += `<circle cx="${px}" cy="${py}" r="3.5" fill="var(--chart-1)" stroke="var(--page)" stroke-width="1.5"/>`;
    s += `<circle cx="${lx}" cy="${ly}" r="8.5" fill="${tagVar(i)}"/><text x="${lx}" y="${ly + 3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--fg)">${i + 1}</text>`;
  });
  return s + "</svg>";
}

/** Radarns numrerade lista: 1 till hälften i vänster kolumn, resten i höger. */
function radarList(axes, lang = "sv") {
  const rows = Math.ceil(axes.length / 2);
  return `<ol class="radarlist" style="grid-template-rows:repeat(${rows}, auto)">${axes.map((a, i) => `<li><span class="n" style="background:${tagVar(i)}">${i + 1}</span><span class="lbl">${a.label}</span><span class="pct">${pct((a.learned / a.total) * 100, lang)}</span></li>`).join("")}</ol>`;
}

/** Områden som liggande staplar (RadarBars): inlärda fyllt, delvis inlärda ljusare. */
function areaBars(axes, lang = "sv") {
  return `<div class="areabars">${axes.map((a, i) => `<div class="r"><span class="n" style="background:${tagVar(i)}">${i + 1}</span><span class="lbl">${a.label}</span><span class="pct">${pct((a.learned / a.total) * 100, lang)}</span><div class="bar"><div style="width:${(a.learned / a.total) * 100}%;background:var(--chart-1)"></div><div style="width:${(a.partial / a.total) * 100}%;background:var(--chart-1);opacity:0.3"></div></div></div>`).join("")}</div>`;
}

/** Aktivitetskarta (ActivityHeatmap.tsx): en ruta per dag, fem nivåer av grönt, måndag överst. */
function heatmap(counts, { weeks = 20, end = "2026-10-01", lang = "sv" } = {}) {
  const CELL = 13, GAP = 3, STEP = CELL + GAP, LEFT = 28, TOP = 16;
  const W = LEFT + weeks * STEP - GAP, H = TOP + 7 * STEP - GAP;
  const last = new Date(`${end}T12:00:00Z`);
  const dow = (last.getUTCDay() + 6) % 7; // måndag = 0
  const start = new Date(last.getTime() - ((weeks - 1) * 7 + dow) * 86400000);
  const max = Math.max(1, ...Object.values(counts));
  const level = (v) => (!v ? 0 : v <= max * 0.25 ? 1 : v <= max * 0.5 ? 2 : v <= max * 0.75 ? 3 : 4);
  const op = [0, 0.25, 0.5, 0.75, 1];
  const months = lang === "sv" ? ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = lang === "sv" ? ["mån", "", "ons", "", "fre", "", ""] : ["Mon", "", "Wed", "", "Fri", "", ""];
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  days.forEach((d, i) => { if (d) s += `<text x="0" y="${TOP + i * STEP + CELL - 3}" font-size="9" fill="var(--muted)">${d}</text>`; });
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * 86400000);
      if (date > last) continue;
      if (d === 0 && date.getUTCMonth() !== lastMonth && date.getUTCDate() <= 7) { lastMonth = date.getUTCMonth(); s += `<text x="${LEFT + w * STEP}" y="10" font-size="9" fill="var(--muted)">${months[lastMonth]}</text>`; }
      const v = counts[date.toISOString().slice(0, 10)] || 0;
      const l = level(v);
      s += `<rect x="${LEFT + w * STEP}" y="${TOP + d * STEP}" width="${CELL}" height="${CELL}" rx="3" fill="${l ? "var(--chart-1)" : "var(--surface-3)"}"${l ? ` fill-opacity="${op[l]}"` : ""}/>`;
    }
  }
  return s + "</svg>";
}

/** Förklaringen till aktivitetskartan: Mindre, fem rutor, Mer. */
function heatmapScale(lang = "sv") {
  const cells = [0, 0.25, 0.5, 0.75, 1].map((o) => `<span style="width:8pt;height:8pt;border-radius:2pt;display:inline-block;background:${o ? `color-mix(in oklab, var(--chart-1) ${o * 100}%, transparent)` : "var(--surface-3)"}"></span>`).join("");
  return `<div class="chart-legend"><span>${lang === "sv" ? "Mindre" : "Less"}</span><span style="gap:2pt">${cells}</span><span>${lang === "sv" ? "Mer" : "More"}</span></div>`;
}

/** Fördelningen av skattningar 1 till 5 i skattningsskalans färger. */
function ratingChart(counts, { w = 300, h = 170, lang = "sv" } = {}) {
  return barChart({ labels: ["1", "2", "3", "4", "5"], values: counts.map((c) => [c]), tones: ["rate-1"], w, h, valueOnTop: true, lang })
    .replace(/fill="var\(--rate-1\)"/g, (() => { let i = 0; return () => `fill="var(--rate-${++i})"`; })());
}

/** Ringdiagram för EN andel (aldrig flera kategorier): spår, båge, procent i mitten. */
function donut(value, total, { label = "", tone = "chart-1", lang = "sv", size = 150 } = {}) {
  const r = size * 0.36, sw = size * 0.1, c = size / 2, circ = 2 * Math.PI * r, f = total ? value / total : 0;
  return `<svg class="chart" viewBox="0 0 ${size} ${size}" role="img"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${sw}"/>` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--${tone})" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(circ * f).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${c} ${c})"/>` +
    `<text x="${c}" y="${c + 2}" text-anchor="middle" font-size="${size * 0.2}" font-weight="800" fill="var(--fg)">${pct(f * 100, lang)}</text>` +
    (label ? `<text x="${c}" y="${c + size * 0.15}" text-anchor="middle" font-size="${size * 0.075}" fill="var(--muted)">${label}</text>` : "") + "</svg>";
}

/** Spridningsdiagram: en prick per kort; markerade punkter i en andra färg. */
function scatter(points, { w = 300, h = 200, xLabel = "", yLabel = "", xMax = 1, yMax = 5, yMin = 1, lang = "sv" } = {}) {
  const PAD = { top: 10, right: 10, bottom: 30, left: 34 };
  const iw = w - PAD.left - PAD.right, ih = h - PAD.top - PAD.bottom;
  const x = (v) => PAD.left + (v / xMax) * iw, y = (v) => PAD.top + ih - ((v - yMin) / (yMax - yMin)) * ih;
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">`;
  for (let v = yMin; v <= yMax; v++) s += `<line x1="${PAD.left}" x2="${w - PAD.right}" y1="${y(v)}" y2="${y(v)}" stroke="var(--chart-grid)"/><text x="${PAD.left - 6}" y="${y(v) + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) s += `<text x="${x(t * xMax)}" y="${h - 16}" text-anchor="middle" font-size="10" fill="var(--muted)">${pct(t * 100, lang)}</text>`;
  s += `<text x="${PAD.left + iw / 2}" y="${h - 3}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${xLabel}</text>`;
  s += `<text x="10" y="${PAD.top + ih / 2}" text-anchor="middle" font-size="9.5" fill="var(--muted)" transform="rotate(-90 10 ${PAD.top + ih / 2})">${yLabel}</text>`;
  for (const p of points.filter((p) => !p.mark)) s += `<circle cx="${x(p.x).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="3" fill="var(--chart-2)" fill-opacity="0.55"/>`;
  for (const p of points.filter((p) => p.mark)) s += `<circle cx="${x(p.x).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="3.6" fill="var(--chart-3)" stroke="var(--page)" stroke-width="1"/>`;
  return s + "</svg>";
}

/** Framstegsstapel (hemsidans "368 av 405 kort sedda"): ett spår och en grön fyllning, texten under. */
function progressBar(value, total, { label = "", height = "6pt" } = {}) {
  return `<div class="progress" style="height:${height}"><div style="width:${total ? (value / total) * 100 : 0}%"></div></div>${label ? `<div class="tiny muted" style="margin-top:4pt">${label}</div>` : ""}`;
}

/** Tabell med inbyggda staplar (granskningsöversiktens rader): namn, antal, andelsstapel och "x av y". */
function barTable(rows, { segments, lang = "sv", head = ["Område", "Kort", "", "Granskade"] } = {}) {
  const tr = rows.map((r, i) => {
    const done = r.values[0] + (r.values[2] ?? 0);
    const all = r.values.reduce((a, b) => a + b, 0);
    return `<tr><td style="white-space:nowrap"><span style="display:inline-flex;align-items:center;gap:5pt"><span class="dot" style="background:${tagVar(r.color ?? i)}"></span>${r.label}</span></td><td class="muted">${all}</td><td class="bar">${shareBar(r.values.map((v, j) => ({ value: v, ...segments[j] })), { height: "4.5pt", legendItems: false })}</td><td style="text-align:right" class="muted">${fmt(done, lang)} av ${fmt(all, lang)}</td></tr>`;
  }).join("");
  return `<table class="t bars"><tr>${head.map((h, i) => `<th${i === 3 ? ' style="text-align:right"' : ""}>${h}</th>`).join("")}</tr>${tr}</table>`;
}

/** Ett diagram på sidan: rubrik, vad och när, diagrammet och källan. */
function chartBlock({ title, sub = "", body, source = "" }) {
  return `<div class="card chartblock"><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ""}${body}${source ? `<div class="src">${source}</div>` : ""}</div>`;
}

module.exports = {
  ROOT, LIGHT, DARK, asset, css, documentHtml, header, footer,
  num, dot, btn, legend, tile, tiles, steps, callout, dots,
  fmt, pct, ticks, tagVar,
  shareBar, progressBar, barTable, chartBlock, barChart, lineChart, radarChart, radarList, areaBars, heatmap, heatmapScale, ratingChart, donut, scatter,
};
