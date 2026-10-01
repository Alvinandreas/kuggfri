/**
 * Körs en gång efter det visuella testet, även när tester fallerat: tar bort teststudenten,
 * testexaminatorn (med progress, historik och examinatorsraden) och adminens
 * förhandsgranskningsförsök. Materialteknik och admin@kuggfri.test rörs inte i övrigt.
 *
 * Fristående: `npx tsx tests/visual/global-teardown.ts`.
 */
import { removeRunnerAttempt, removeVisualUsers } from "./data";

export default async function globalTeardown() {
  try {
    await removeRunnerAttempt();
    await removeVisualUsers();
  } catch (error) {
    // En misslyckad städning ska synas men inte göra en grön körning röd.
    console.warn(`Städningen efter det visuella testet misslyckades: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (process.argv[1] && /global-teardown\.ts$/.test(process.argv[1]) && process.argv[1].includes("visual")) {
  void globalTeardown();
}
