"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, LoaderCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { hasLocalProgress } from "@/lib/progress/local-store";
import { migrateLocalProgressToAccount } from "@/lib/progress/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Körs på varje sida när användaren är inloggad. Finns lokal gästprogress
 * flyttas den till kontot (senaste last_review vinner) och localStorage rensas.
 */
export function ProgressMigrator({ userId }: { userId: string | null }) {
  const sv = useT();
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
  const Icon = status === "running" ? LoaderCircle : CircleCheckBig;
  return (
    <p
      role="status"
      data-testid="migration-status"
      className="anim-fade-up mx-auto mb-6 flex w-full max-w-[var(--content-width)] items-center gap-3 rounded-lg bg-accent-soft px-4 py-3 text-sm font-medium text-accent-ink"
    >
      <Icon size={18} aria-hidden className={status === "running" ? "shrink-0 motion-safe:animate-spin" : "shrink-0"} />
      <span>{status === "running" ? sv.auth.migrating : sv.auth.migrated(count)}</span>
    </p>
  );
}
