/**
 * Städar text från Brainscape-exporter till giltig markdown.
 * Används av seed-bygget. Admin-importen rör inte texten.
 *
 * - "− " (minustecken) och "– " (tankstreck) i början av rad blir nästlade
 *   punkter under närmast föregående "* "-punkt.
 * - En rad som slutar med kolon och följer direkt på en listpunkt får en tom
 *   rad före sig så att den inte slås ihop med punkten.
 * - Windows-radbrytningar och avslutande blanksteg tas bort.
 */
export function normalizeBrainscapeMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  /** Vilken typ av lista vi befinner oss i: "star" (* eller 1.) nästlar streckrader under sig. */
  let list: "star" | "dash" | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const trimmed = line.trim();

    if (trimmed === "") {
      list = null;
      out.push("");
      continue;
    }

    if (/^\* /.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      list = "star";
      out.push(trimmed);
      continue;
    }

    if (/^[−–-] /.test(trimmed)) {
      const item = trimmed.replace(/^[−–-] /, "");
      if (list === "star") {
        out.push(`  - ${item}`);
      } else {
        out.push(`- ${item}`);
        list = "dash";
      }
      continue;
    }

    if (list !== null && /:$/.test(trimmed) && /^[A-ZÅÄÖ]/.test(trimmed)) {
      out.push("");
      out.push(trimmed);
      list = null;
      continue;
    }

    out.push(trimmed);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
