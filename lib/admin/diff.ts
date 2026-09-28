/**
 * En liten, beroendefri textdiff för kortens historik och rättelser: vad som tagits bort och
 * lagts till mellan två versioner av en text. Ordbaserad (ord, blanksteg och skiljetecken är
 * egna delar) med LCS, så att en ändrad formulering syns som just den ändringen. Blir texterna
 * för stora för ordnivå faller den tillbaka på rader, och i sista hand på "allt ersatt".
 *
 * Ren modul utan React och Supabase, så att den kan enhetstestas.
 */

export type DiffPart = { type: "same" | "del" | "add"; text: string };

/** Största antalet celler i LCS-tabellen innan vi går ner en nivå (ord, rader, allt). */
export const MAX_DIFF_CELLS = 400_000;

/** Delar upp i ord (bokstäver och siffror), blanksteg och enstaka skiljetecken. */
export function tokenizeWords(text: string): string[] {
  return text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
}

/** Delar upp i rader; radbrytningen hör till raden före. */
export function tokenizeLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

/** LCS-diff av två tokenlistor. null om tabellen skulle bli större än maxCells. */
function lcsDiff(a: readonly string[], b: readonly string[], maxCells: number): DiffPart[] | null {
  // Gemensam början och slut behöver ingen tabell.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;
  if (n * m > maxCells) return null;

  const parts: DiffPart[] = a.slice(0, start).map((text) => ({ type: "same", text }));
  if (n === 0 || m === 0) {
    for (const text of midA) parts.push({ type: "del", text });
    for (const text of midB) parts.push({ type: "add", text });
  } else {
    // lengths[i][j] = LCS-längd för midA[i..] och midB[j..], i en platt tabell.
    const w = m + 1;
    const lengths = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lengths[i * w + j] = midA[i] === midB[j] ? lengths[(i + 1) * w + j + 1]! + 1 : Math.max(lengths[(i + 1) * w + j]!, lengths[i * w + j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        parts.push({ type: "same", text: midA[i]! });
        i++;
        j++;
      } else if (lengths[(i + 1) * w + j]! >= lengths[i * w + j + 1]!) {
        parts.push({ type: "del", text: midA[i]! });
        i++;
      } else {
        parts.push({ type: "add", text: midB[j]! });
        j++;
      }
    }
    for (; i < n; i++) parts.push({ type: "del", text: midA[i]! });
    for (; j < m; j++) parts.push({ type: "add", text: midB[j]! });
  }
  for (const text of a.slice(endA)) parts.push({ type: "same", text });
  return parts;
}

/** Varje sammanhängande ändring som en borttagning följd av ett tillägg; lika delar ihopslagna. */
function mergeRuns(parts: readonly DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  let del = "";
  let add = "";
  const flush = () => {
    if (del) out.push({ type: "del", text: del });
    if (add) out.push({ type: "add", text: add });
    del = "";
    add = "";
  };
  for (const p of parts) {
    if (p.type === "del") del += p.text;
    else if (p.type === "add") add += p.text;
    else if (p.text) {
      flush();
      const last = out[out.length - 1];
      if (last?.type === "same") last.text += p.text;
      else out.push({ type: "same", text: p.text });
    }
  }
  flush();
  return out;
}

/** Ett kort mellanstycke (blanksteg eller ett litet ord, ingen radbrytning) mellan två ändringar. */
function isShortGap(text: string): boolean {
  return !text.includes("\n") && text.trim().length <= 3;
}

/**
 * Städar diffen för läsbarhet: varje sammanhängande ändring blir en borttagning följd av ett
 * tillägg (i stället för ord för ord om vartannat), och korta lika stycken mellan två ändringar
 * (ett mellanrum, "i", "vid") räknas till ändringen, så att en omskriven fras syns som en helhet.
 */
export function cleanupDiff(parts: readonly DiffPart[]): DiffPart[] {
  const runs = mergeRuns(parts);
  const out: DiffPart[] = [];
  for (let k = 0; k < runs.length; k++) {
    const p = runs[k]!;
    const prev = runs[k - 1];
    const next = runs[k + 1];
    if (p.type === "same" && prev && next && prev.type !== "same" && next.type !== "same" && isShortGap(p.text)) {
      out.push({ type: "del", text: p.text }, { type: "add", text: p.text });
    } else out.push(p);
  }
  return mergeRuns(out);
}

/**
 * Skillnaden mellan två texter: delar som är lika, borttagna (bara i before) och tillagda
 * (bara i after). Ihopsatta ger same+del texten before och same+add texten after.
 */
export function diffText(before: string, after: string, maxCells = MAX_DIFF_CELLS): DiffPart[] {
  if (before === after) return before ? [{ type: "same", text: before }] : [];
  const words = lcsDiff(tokenizeWords(before), tokenizeWords(after), maxCells);
  if (words) return cleanupDiff(words);
  const lines = lcsDiff(tokenizeLines(before), tokenizeLines(after), maxCells);
  if (lines) return cleanupDiff(lines);
  return cleanupDiff([
    { type: "del", text: before },
    { type: "add", text: after },
  ]);
}

/**
 * Diff av två listor med nycklar (en del per element, ingen städning), t.ex. svarsalternativ.
 * Listorna är korta, så tabellstorleken begränsas inte.
 */
export function diffSequence(before: readonly string[], after: readonly string[]): DiffPart[] {
  return lcsDiff(before, after, Number.POSITIVE_INFINITY)!;
}

/** Texten före (same + del) respektive efter (same + add), t.ex. för att kontrollera en diff. */
export function diffSides(parts: readonly DiffPart[]): { before: string; after: string } {
  let before = "";
  let after = "";
  for (const p of parts) {
    if (p.type !== "add") before += p.text;
    if (p.type !== "del") after += p.text;
  }
  return { before, after };
}
