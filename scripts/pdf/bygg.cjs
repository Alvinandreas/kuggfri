/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Bygger Kuggfris PDF:er från scripts/pdf/: HTML i docs/, PDF bredvid, sidbilder för granskning i
 * en temporär mapp. Stoppar om en sida rinner över, Figtree saknas, en bild saknas eller mittpunkten (U+00B7) finns.
 *
 *   npm run pdf                      alla
 *   npm run pdf -- designsystem      docs/Designsystem.pdf
 *   npm run pdf -- granskningsguide  docs/granskningsguide-sv.pdf och docs/review-guide-en.pdf
 *   npm run pdf -- studentguide      docs/Studentguide.pdf
 */
const { skrivUt } = require("./skriv-ut.cjs");

const DOKUMENT = {
  designsystem: () => require("./designsystem.cjs"),
  granskningsguide: () => require("./granskningsguide.cjs"),
  studentguide: () => require("./studentguide.cjs"),
  motesunderlag: () => require("./motesunderlag.cjs"),
  infoblad: () => require("./infoblad.cjs"),
};

(async () => {
  const valda = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const namn = valda.length ? valda : Object.keys(DOKUMENT);
  for (const n of namn) {
    if (!DOKUMENT[n]) throw new Error(`Okänt dokument "${n}". Välj bland: ${Object.keys(DOKUMENT).join(", ")}`);
    await DOKUMENT[n]().bygg(skrivUt);
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
