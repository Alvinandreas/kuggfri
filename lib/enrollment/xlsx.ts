/**
 * Läser första bladet i en Excel-fil (.xlsx) som text med tabb mellan cellerna, en rad per rad,
 * så att den går genom samma läsare som en inklistrad lista (parse.ts). Ingen beroende: en
 * .xlsx är ett zip-arkiv med XML, och zip-formatets deflate packas upp med DecompressionStream,
 * som finns i alla webbläsare och i Node. Körs i webbläsaren; filen skickas aldrig till servern.
 *
 * Bara det som behövs för en deltagarlista: delade strängar, inbäddade strängar, tal och
 * formelresultat. Formatering, datum och flera blad ignoreras. Gamla .xls (binärt) stöds inte.
 */

export class XlsxError extends Error {}

const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

/** Filerna i zip-arkivet, uppackade vid behov. */
function zipEntries(bytes: Uint8Array): Map<string, () => Promise<Uint8Array>> {
  // Slutposten (EOCD) ligger sist, före en eventuell kommentar på högst 64 kB.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxError("inte ett zip-arkiv");
  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  const entries = new Map<string, () => Promise<Uint8Array>>();
  for (let i = 0; i < count; i++) {
    if (u32(bytes, p) !== 0x02014b50) throw new XlsxError("trasig innehållsförteckning");
    const method = u16(bytes, p + 10);
    const size = u32(bytes, p + 20);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const local = u32(bytes, p + 42);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    // Storleken i innehållsförteckningen gäller även när den lokala posten använder en databeskrivning.
    const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
    const data = bytes.subarray(start, start + size);
    entries.set(name, async () => {
      if (method === 0) return data;
      if (method !== 8) throw new XlsxError(`komprimeringsmetod ${method} stöds inte`);
      const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Texten i ett <si>- eller <is>-element: alla <t>-delar (formaterad text har flera). */
function textRuns(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1] ?? "")).join("");
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Sökvägen till arbetsbokens första blad, via workbook.xml och dess relationer. */
function firstSheetPath(workbook: string, rels: string): string {
  const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  const target = rid ? new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*\\bTarget="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${rid}"`).exec(rels)?.[1] : undefined;
  if (!target) return "xl/worksheets/sheet1.xml";
  return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
}

/** Första bladets celler, rad för rad. */
export async function xlsxRows(bytes: Uint8Array): Promise<string[][]> {
  const entries = zipEntries(bytes);
  const read = async (name: string) => {
    const get = entries.get(name);
    return get ? new TextDecoder().decode(await get()) : null;
  };
  const workbook = await read("xl/workbook.xml");
  if (workbook === null) throw new XlsxError("ingen arbetsbok");
  const sheetXml = await read(firstSheetPath(workbook, (await read("xl/_rels/workbook.xml.rels")) ?? ""));
  if (sheetXml === null) throw new XlsxError("inget blad");
  const shared = [...((await read("xl/sharedStrings.xml")) ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1] ?? ""));

  const rows: string[][] = [];
  // En tom rad kan vara <row r="5"/>; den får inte svälja nästa rad.
  for (const row of sheetXml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells: string[] = [];
    let next = 0;
    for (const c of (row[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1] ?? "";
      const body = c[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const index = ref ? columnIndex(ref) : next;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? "n";
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = textRuns(body);
      else if (v !== undefined) value = decodeXml(v);
      while (cells.length < index) cells.push("");
      cells[index] = value;
      next = index + 1;
    }
    rows.push(cells);
  }
  return rows;
}

/** Första bladet som tabbseparerad text, för parseRoster. */
export async function xlsxToText(bytes: Uint8Array): Promise<string> {
  const rows = await xlsxRows(bytes);
  return rows.map((r) => r.map((c) => c.replace(/[\t\r\n]+/g, " ").trim()).join("\t")).join("\n");
}

/** Ser filen ut som en .xlsx (namn eller typ)? */
export function isXlsx(file: { name: string; type: string }): boolean {
  return /\.xlsx$/i.test(file.name) || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}
