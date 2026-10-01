import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { sv } from "@/lib/i18n/sv";

/**
 * Varje text i sv (lib/i18n/sv.ts) ska användas någonstans. Testet läser koden med TypeScripts
 * parser och följer varje användning av sv: sv.a.b, sv.a["b"], typeof sv.a.b, alias som
 * `const t = sv.deck` (då följs t inom samma block) och destrukturering `const { x } = sv.deck`.
 * När ett objekt används som helhet (skickas vidare, sprids, indexeras med en variabel som
 * sv.study.rate[r], exporteras) räknas hela underträdet som använt. Analysen gissar alltså hellre
 * att en text används än tvärtom. Faller testet: ta bort texten ur lib/i18n/sv/, eller lägg den i
 * UNDANTAG nedan med en kommentar om varför analysen inte ser användningen.
 */
const UNDANTAG: ReadonlySet<string> = new Set([
  // Inga undantag behövs i dag. Exempel: "deck.someKey", // läses via en nyckel från databasen
]);

const ROOT = process.cwd();
const DIRS = ["app", "components", "lib", "scripts", "tests"];
const FILES = ["middleware.ts"];
const EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const SELF = "tests/unit/text/i18n-oanvanda.test.ts";

type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => typeof v === "object" && v !== null && !Array.isArray(v);
const rel = (full: string) => relative(ROOT, full).replace(/\\/g, "/");

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".next")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXT.has(extname(name))) out.push(full);
  }
  return out;
}

function leaves(obj: Tree, prefix: string[] = []): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (isTree(v) ? leaves(v, [...prefix, k]) : [[...prefix, k].join(".")]));
}

function valueAt(path: readonly string[]): unknown {
  let cur: unknown = sv;
  for (const k of path) cur = isTree(cur) ? cur[k] : undefined;
  return cur;
}

/** Är identifieraren ett egenskapsnamn (t.ex. `x` i `a.x` eller `{ x: 1 }`) och inte en variabel? */
function isPropertyName(n: ts.Identifier): boolean {
  const p = n.parent;
  return (
    ((ts.isPropertyAccessExpression(p) || ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p)) && p.name === n) ||
    (ts.isQualifiedName(p) && p.right === n) ||
    (ts.isBindingElement(p) && p.propertyName === n) ||
    ts.isJsxAttribute(p) ||
    ts.isImportSpecifier(p)
  );
}

/** Samlar använda vägar i sv ("deck.title"); en väg till ett objekt betyder hela underträdet. */
function usedPaths(): Set<string> {
  const used = new Set<string>();

  function track(node: ts.Node, base: readonly string[], sf: ts.SourceFile) {
    const path = [...base];
    let cur: ts.Node = node;
    for (;;) {
      if (!isTree(valueAt(path))) {
        used.add(path.join("."));
        return;
      }
      const p: ts.Node = cur.parent;
      if (ts.isPropertyAccessExpression(p) && p.expression === cur) path.push(p.name.text);
      else if (ts.isQualifiedName(p) && p.left === cur) path.push(p.right.text);
      else if (ts.isElementAccessExpression(p) && p.expression === cur) {
        const arg = p.argumentExpression;
        if (!ts.isStringLiteralLike(arg) && !ts.isNumericLiteral(arg)) break; // dynamisk nyckel: hela objektet
        path.push(arg.text);
      } else if (!ts.isParenthesizedExpression(p) && !ts.isNonNullExpression(p)) break;
      cur = p;
    }
    const decl = cur.parent;
    const stmt = decl.parent?.parent;
    const exported = !!stmt && ts.isVariableStatement(stmt) && !!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isVariableDeclaration(decl) && decl.initializer === cur && !exported) bind(decl.name, path, stmt ?? sf, sf);
    else used.add(path.join("."));
  }

  /** `const t = sv.x` eller `const { a, b: { c } } = sv.x`: följ namnen inom blocket där de deklareras. */
  function bind(name: ts.BindingName, path: readonly string[], stmt: ts.Node, sf: ts.SourceFile) {
    if (ts.isIdentifier(name)) {
      const scope = stmt.parent ?? sf;
      const visit = (n: ts.Node) => {
        if (ts.isIdentifier(n) && n.text === name.text && n !== name && !isPropertyName(n)) track(n, path, sf);
        ts.forEachChild(n, visit);
      };
      visit(scope);
      return;
    }
    if (ts.isArrayBindingPattern(name)) {
      used.add(path.join("."));
      return;
    }
    for (const el of name.elements) {
      const prop = el.propertyName ?? el.name;
      if (el.dotDotDotToken || !(ts.isIdentifier(prop) || ts.isStringLiteral(prop))) {
        used.add(path.join("."));
        continue;
      }
      const sub = [...path, prop.text];
      if (isTree(valueAt(sub))) bind(el.name, sub, stmt, sf);
      else used.add(sub.join("."));
    }
  }

  const files = [...DIRS.flatMap((d) => walk(join(ROOT, d))), ...FILES.map((f) => join(ROOT, f)).filter((f) => existsSync(f))];
  for (const full of files) {
    const file = rel(full);
    if (file.startsWith("lib/i18n/") || file === SELF) continue;
    const text = readFileSync(full, "utf8");
    if (!text.includes("i18n/sv")) continue;
    const kind = /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(full, text, ts.ScriptTarget.Latest, true, kind);
    let local: string | undefined;
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !/i18n\/sv$/.test(st.moduleSpecifier.text)) continue;
      const nb = st.importClause?.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) used.add(""); // import * as: kan inte följas, räkna allt som använt
      if (nb && ts.isNamedImports(nb)) for (const s of nb.elements) if ((s.propertyName ?? s.name).text === "sv") local = s.name.text;
    }
    if (!local) continue;
    const visit = (n: ts.Node) => {
      if (ts.isIdentifier(n) && n.text === local && !isPropertyName(n)) track(n, [], sf);
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return used;
}

describe("texterna i lib/i18n/sv", () => {
  it("används alla någonstans i koden", () => {
    const used = usedPaths();
    // Använd om texten själv eller något objekt ovanför den används ("" = hela sv).
    const isUsed = (leaf: string) => {
      const parts = leaf.split(".");
      return parts.some((_, i) => used.has(parts.slice(0, i + 1).join("."))) || used.has("");
    };
    const unused = leaves(sv as unknown as Tree).filter((leaf) => !isUsed(leaf) && !UNDANTAG.has(leaf));
    expect(unused, "oanvända texter: ta bort dem ur lib/i18n/sv/ (eller lägg dem i UNDANTAG med en kommentar)").toEqual([]);
  });

  it("har inga inaktuella undantag", () => {
    const all = new Set(leaves(sv as unknown as Tree));
    expect([...UNDANTAG].filter((k) => !all.has(k))).toEqual([]);
  });
});
