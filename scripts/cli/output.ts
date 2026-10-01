/** Utskrift och frågor i terminalen, delade av kuggfri-CLI:ts kommandon. */
import { createInterface } from "node:readline/promises";

export const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
};

export function say(text = "") {
  console.log(text);
}
export function dim(text: string) {
  return `${C.dim}${text}${C.reset}`;
}
export function fail(message: string): never {
  console.error(`${C.red}Fel:${C.reset} ${message}`);
  process.exit(1);
}

export async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [j/N] `);
    return answer.trim().toLowerCase().startsWith("j");
  } finally {
    rl.close();
  }
}
