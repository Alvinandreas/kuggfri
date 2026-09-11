"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { hasLocalProgress } from "@/lib/progress/local-store";
import { migrateLocalProgressToAccount } from "@/lib/progress/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Körs på varje sida när användaren är inloggad. Finns lokal gästprogress
 * flyttas den till kontot (senaste last_review vinner) och localStorage rensas.
 */
export function ProgressMigrator({ userId }: { userId: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    try {
      if (!hasLocalProgress(window.localStorage)) return;
    } catch {
      return;
    }
    setStatus("running");
    migrateLocalProgressToAccount(window.localStorage, createSupabaseBrowserClient(), userId)
      .then((n) => {
        if (cancelled) return;
        setCount(n);
        setStatus("done");
        router.refresh();
        setTimeout(() => {
          if (!cancelled) setStatus("idle");
        }, 6000);
      })
      .catch(() => {
        if (!cancelled) setStatus("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, router]);

  if (status === "idle") return null;
  return (
    <p role="status" data-testid="migration-status" className="mx-auto mb-4 w-full max-w-[var(--content-width)] rounded-md bg-accent-soft px-4 py-2 text-sm">
      {status === "running" ? sv.auth.migrating : sv.auth.migrated(count)}
    </p>
  );
}
