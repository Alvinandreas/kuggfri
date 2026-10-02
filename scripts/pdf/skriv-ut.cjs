/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Skriver ut en HTML-sida (byggd med scripts/pdf/tema.cjs) till PDF med Playwrights Chromium, och
 * stoppar om något är fel: en sida som rinner över, Figtree som inte laddats, mittpunkten U+00B7 (som aldrig
 * får förekomma) eller en bild som inte hittas. Varje sida sparas också som PNG för granskning.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require(path.resolve(__dirname, "../../node_modules/playwright"));

/**
 * @param {{ html: string, htmlFile: string, pdfFile: string, name: string }} opts
 * @returns {Promise<{ pages: number, pngDir: string }>}
 */
async function skrivUt({ html, htmlFile, pdfFile, name }) {
  fs.mkdirSync(path.dirname(htmlFile), { recursive: true });
  fs.writeFileSync(htmlFile, html);
  const pngDir = path.join(os.tmpdir(), "kuggfri-pdf", name);
  fs.rmSync(pngDir, { recursive: true, force: true });
  fs.mkdirSync(pngDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1.5 });
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const check = await page.evaluate(() => ({
      overflow: [...document.querySelectorAll(".page")].map((p, i) => ({ page: i + 1, px: p.scrollHeight - p.clientHeight })).filter((o) => o.px > 0),
      font: document.fonts.check("12px Figtree"),
      middot: document.body.innerText.includes(String.fromCharCode(0xb7)),
      brokenImages: [...document.images].filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.getAttribute("src")),
      pages: document.querySelectorAll(".page").length,
    }));
    const problems = [];
    for (const o of check.overflow) problems.push(`sidan ${o.page} rinner över med ${o.px} px`);
    if (!check.font) problems.push("Figtree laddades inte");
    if (check.middot) problems.push("mittpunkten (U+00B7) förekommer");
    for (const src of check.brokenImages) problems.push(`bilden hittas inte: ${src}`);
    if (problems.length) throw new Error(`${name}: ${problems.join("; ")}`);

    await page.pdf({ path: pdfFile, format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    for (let i = 0; i < check.pages; i++) await page.locator(".page").nth(i).screenshot({ path: path.join(pngDir, `sida-${String(i + 1).padStart(2, "0")}.png`) });
    console.log(`${name}: ${check.pages} sidor -> ${path.relative(process.cwd(), pdfFile)} (sidbilder för granskning: ${pngDir})`);
    return { pages: check.pages, pngDir };
  } finally {
    await browser.close();
  }
}

module.exports = { skrivUt };
