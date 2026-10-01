/** Git från CLI:t: läser bara, skriver aldrig. */
import { execFileSync } from "node:child_process";
import { lines } from "@/lib/text/newlines";

export function gitHead(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

/** Utdata från ett git-kommando, rad för rad (git på Windows kan svara med CRLF). */
export function gitLines(args: string[]): string[] {
  return lines(execFileSync("git", args, { encoding: "utf8" }));
}
