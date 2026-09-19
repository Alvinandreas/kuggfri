/**
 * Granskningsunderlag: alla kort i ett deck som utskriftsvänlig PDF, per kategori,
 * med kryssrutor och anteckningsrad per kort. Avsett att lämnas hos en examinator
 * eller kursansvarig för innehållsgranskning.
 *
 *   npx tsx scripts/build-review-pdf.tsx [materialteknik] [docs/granskning-materialteknik.pdf]
 *
 * Läser kursen ur content/ (samma text som ligger i databasen), react-markdown + KaTeX
 * för rendering, och Playwrights Chromium för PDF-utskriften.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { chromium } from "@playwright/test";
import { loadCourse } from "../lib/content/store";

type Manifest = {
  title: string;
  course_code?: string | null;
  source_credit?: string | null;
};

type ReviewCard = { n: number; front: string; back: string; hint: string | null };
type ReviewCategory = { title: string; cards: ReviewCard[] };

function loadDeck(courseKey: string): { manifest: Manifest; categories: ReviewCategory[]; total: number } {
  const { course, issues } = loadCourse(process.cwd(), courseKey);
  for (const issue of issues) console.warn(`  ${issue.file}:${issue.line} ${issue.message}`);
  let n = 0;
  const categories: ReviewCategory[] = course.categories.map((cat) => ({
    title: cat.title,
    cards: cat.cards
      .filter((card) => card.active)
      .map((card) => {
        n++;
        return { n, front: card.front, back: card.back, hint: card.hint };
      }),
  }));
  return {
    manifest: { title: course.title, course_code: course.course_code ?? undefined, source_credit: course.source_credit ?? undefined },
    categories,
    total: n,
  };
}

function Md({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
      {text}
    </ReactMarkdown>
  );
}

function Page({ manifest, categories, total, date }: { manifest: Manifest; categories: ReviewCategory[]; total: number; date: string }) {
  return (
    <html lang="sv">
      {/* Fristående skript (inte en Next-sida): vanligt <head> är rätt här. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <title>{`Granskningsunderlag: ${manifest.title}`}</title>
      </head>
      <body>
        <header className="cover">
          <p className="kicker">Kuggfri · granskningsunderlag</p>
          <h1>{manifest.title}</h1>
          <p className="meta">
            {manifest.course_code ? `${manifest.course_code} · ` : ""}
            {total} kort i {categories.length} kategorier · utskrivet {date}
          </p>
          {manifest.source_credit ? <p className="credit">{manifest.source_credit}</p> : null}
          <div className="howto">
            <p>
              <strong>Så här granskar du.</strong> Kryssa per kort: <span className="box" /> OK, <span className="box" /> Fel i sak,{" "}
              <span className="box" /> Otydligt, <span className="box" /> Utanför kursen. Skriv gärna en rad på anteckningsraden. Kort som
              ska bort: stryk numret. Kort som saknas: skriv dem på sista sidan.
            </p>
            <p>
              Samma innehåll finns på <strong>kuggfri.com</strong>, där studenter kan rapportera fel direkt från kortet och där du som
              granskare kan rätta i webbläsaren.
            </p>
          </div>
          <h2 className="toc-title">Innehåll</h2>
          <ol className="toc">
            {categories.map((c) => (
              <li key={c.title}>
                {c.title} <span className="muted">({c.cards.length} kort)</span>
              </li>
            ))}
          </ol>
        </header>

        {categories.map((c, i) => (
          <section key={c.title} className="category">
            <h2>
              <span className="catno">{i + 1}</span> {c.title} <span className="muted">· {c.cards.length} kort</span>
            </h2>
            {c.cards.map((card) => (
              <article key={card.n} className="card">
                <div className="num">{card.n}</div>
                <div className="body">
                  <div className="front">
                    <Md text={card.front} />
                  </div>
                  <div className="back">
                    <Md text={card.back} />
                  </div>
                  {card.hint ? (
                    <div className="hint">
                      <span className="muted">Ledtråd: </span>
                      <Md text={card.hint} />
                    </div>
                  ) : null}
                  <div className="review">
                    <span>
                      <span className="box" /> OK
                    </span>
                    <span>
                      <span className="box" /> Fel
                    </span>
                    <span>
                      <span className="box" /> Otydligt
                    </span>
                    <span>
                      <span className="box" /> Utanför kursen
                    </span>
                    <span className="note" />
                  </div>
                </div>
              </article>
            ))}
          </section>
        ))}

        <section className="extra">
          <h2>Kort som saknas, övriga synpunkter</h2>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="line" />
          ))}
        </section>
      </body>
    </html>
  );
}

const css = `
  @page { size: A4; margin: 16mm 14mm 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 10.5pt; line-height: 1.4; color: #1a1a1a; margin: 0; }
  h1 { font-size: 26pt; margin: 4pt 0 6pt; letter-spacing: -0.01em; }
  h2 { font-size: 14pt; margin: 0 0 8pt; padding-bottom: 4pt; border-bottom: 1.5pt solid #1f7a4d; }
  p { margin: 0 0 6pt; }
  .kicker { color: #1f7a4d; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; font-size: 9pt; }
  .meta { color: #555; }
  .credit { color: #555; font-size: 9.5pt; margin-top: 8pt; }
  .howto { margin-top: 14pt; padding: 10pt 12pt; border: 1pt solid #cfd8d2; border-radius: 6pt; background: #f3f8f5; }
  .toc-title { margin-top: 18pt; }
  .toc { columns: 2; padding-left: 18pt; margin: 0; }
  .toc li { break-inside: avoid; margin-bottom: 3pt; }
  .muted { color: #666; font-weight: 400; }
  .cover { break-after: page; }
  .category { break-before: page; }
  .catno { display: inline-block; min-width: 1.6em; padding: 0 4pt; margin-right: 4pt; border-radius: 4pt; background: #1f7a4d; color: #fff; font-size: 11pt; text-align: center; }
  .card { display: grid; grid-template-columns: 24pt 1fr; gap: 6pt; padding: 7pt 0; border-bottom: 0.6pt solid #d9d9d9; break-inside: avoid; }
  .num { color: #1f7a4d; font-weight: 700; font-variant-numeric: tabular-nums; padding-top: 1pt; }
  .front { font-weight: 600; }
  .back { margin-top: 2pt; }
  .hint { margin-top: 2pt; font-size: 9.5pt; color: #444; }
  .body p:last-child { margin-bottom: 0; }
  .body ul, .body ol { margin: 2pt 0 4pt; padding-left: 16pt; }
  .review { display: flex; gap: 12pt; align-items: center; margin-top: 5pt; font-size: 9pt; color: #444; }
  .review .note { flex: 1; border-bottom: 0.6pt dotted #888; height: 12pt; }
  .box { display: inline-block; width: 9pt; height: 9pt; border: 0.8pt solid #444; border-radius: 1.5pt; vertical-align: -1.5pt; margin-right: 2pt; background: #fff; }
  .extra { break-before: page; }
  .extra .line { border-bottom: 0.6pt solid #999; height: 22pt; }
  .katex { font-size: 1.02em; }
`;

async function main() {
  const courseKey = process.argv[2] ?? "materialteknik";
  const outPdf = resolve(process.argv[3] ?? "docs/granskning-materialteknik.pdf");
  const { manifest, categories, total } = loadDeck(courseKey);
  const date = new Date().toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" });

  const katexCss = pathToFileURL(resolve("node_modules/katex/dist/katex.min.css")).href;
  let html = renderToStaticMarkup(<Page manifest={manifest} categories={categories} total={total} date={date} />);
  html = html.replace("</head>", `<link rel="stylesheet" href="${katexCss}"><style>${css}</style></head>`);
  html = "<!doctype html>" + html;

  const outDir = resolve(process.env.REVIEW_TMP ?? ".next-review");
  mkdirSync(outDir, { recursive: true });
  mkdirSync(resolve(outPdf, ".."), { recursive: true });
  const htmlPath = join(outDir, "granskning.html");
  writeFileSync(htmlPath, html, "utf8");

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    await page.pdf({
      path: outPdf,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;font-size:8pt;color:#666;padding:0 14mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial,sans-serif;">' +
        `<span>Kuggfri · ${manifest.title} · granskningsunderlag</span><span>Sida <span class="pageNumber"></span> av <span class="totalPages"></span></span></div>`,
    });
  } finally {
    await browser.close();
  }
  console.log(`Skrev ${outPdf}: ${total} kort, ${categories.length} kategorier.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
