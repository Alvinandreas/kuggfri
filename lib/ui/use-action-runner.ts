import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";

/** Svaret från en serveråtgärd som listorna i admin kör. */
export type ActionResult = { ok: boolean; error?: string };

/**
 * Kör serveråtgärder i en transition med gemensam felstatus och sidomladdning.
 * `pending` och `error` styr knappar och felbanner i komponenten som använder hooken.
 */
export function useActionRunner() {
  const sv = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /** Väntar på åtgärden. Vid fel visas felet; annars nollställs det, onOk körs och sidan läses om. */
  function handle(promise: Promise<ActionResult>, onOk?: () => void) {
    startTransition(async () => {
      const result = await promise;
      if (!result.ok) setError(result.error ?? sv.errors.generic);
      else {
        setError(null);
        onOk?.();
        router.refresh();
      }
    });
  }

  /** Nollställer felet direkt, startar åtgärden i transitionen och läser om sidan oavsett utfall. */
  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? sv.errors.generic);
      router.refresh();
    });
  }

  return { pending, error, handle, run };
}
