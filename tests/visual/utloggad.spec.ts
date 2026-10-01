/**
 * Utloggad: landningssidan, inloggningsflödet, informationssidorna, kursinbjudan och 404.
 */
import { DECK_SLUG } from "./data";
import { open, shot, test } from "./fixtures";

const PAGES: readonly [name: string, url: string][] = [
  ["startsida", "/"],
  ["logga-in", "/logga-in"],
  ["registrera", "/registrera"],
  ["glomt-losenord", "/glomt-losenord"],
  ["om", "/om"],
  ["hjalp", "/hjalp"],
  ["integritet", "/integritet"],
  ["kursinbjudan", `/kurs/${DECK_SLUG}`],
  ["404", "/sidan-finns-inte"],
];

test.describe("utloggad", () => {
  for (const [name, url] of PAGES) {
    test(name, async ({ page }) => {
      await open(page, url);
      await shot(page, name);
    });
  }
});
