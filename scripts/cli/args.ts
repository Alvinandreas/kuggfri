/** Kommandoradens argument, delade av kuggfri-CLI:ts kommandon (scripts/kuggfri.ts). */

/** Repots rot: CLI:t körs från den (npm run kuggfri). */
export const ROOT = process.cwd();

export type Args = { positional: string[]; flags: Record<string, string | boolean> };

export function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a.startsWith("--")) {
      const name = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else flags[name] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}
