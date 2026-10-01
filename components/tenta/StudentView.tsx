"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { setStudentViewAction } from "@/lib/tentor/actions";
import type { StudentView } from "@/lib/tentor/queries";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cx } from "@/components/ui/cx";
import { routes } from "@/lib/routes";

/**
 * "Visa som student" för redaktörer: sätter studentvyn för kursen (en kaka som servern bara
 * respekterar för redaktörer) och går till tentaläget.
 */
export function StudentViewButton({ deckId, slug, variant = "outline", className }: { deckId: string; slug: string; variant?: "outline" | "secondary"; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function start() {
    setError(null);
    startTransition(async () => {
      const res = await setStudentViewAction(deckId, "oppen");
      if (!res.ok) return setError(res.error);
      router.push(routes.exam(slug));
      router.refresh();
    });
  }
  return (
    <span className={cx("inline-flex flex-col items-start gap-1", className)}>
      <Button variant={variant} size="sm" onClick={start} disabled={pending} data-testid="student-view-start">
        <Eye size={15} aria-hidden />
        {sv.tenta.studentView}
      </Button>
      {error ? (
        <span role="alert" className="text-sm font-medium text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Raden överst i studentvyn: diskret men tydlig. Öppet/Låst växlar mellan tentaläget som det ser
 * ut för studenterna när det är öppet och när det är låst; Avsluta går tillbaka till redaktörens vy.
 */
export function StudentViewBar({ deckId, mode, className }: { deckId: string; mode: StudentView; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function set(next: StudentView | null) {
    setError(null);
    startTransition(async () => {
      const res = await setStudentViewAction(deckId, next);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }
  return (
    <div
      role="region"
      aria-label={sv.tenta.studentViewTitle}
      className={cx("mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-2.5 text-sm", pending && "opacity-70", className)}
      data-testid="student-view-bar"
      data-mode={mode}
    >
      <p className="flex min-w-0 flex-1 basis-64 items-start gap-2">
        <Eye size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
        <span>
          <span className="font-bold">{sv.tenta.studentViewTitle}</span>
          <span className="block text-muted">{sv.tenta.studentViewBody}</span>
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label={sv.tenta.studentViewMode}
          size="sm"
          value={mode}
          onChange={(v) => v !== mode && set(v)}
          segments={[
            { value: "oppen", label: sv.tenta.studentViewOpen },
            { value: "last", label: sv.tenta.studentViewLocked },
          ]}
        />
        <Button variant="ghost" size="sm" onClick={() => set(null)} disabled={pending} data-testid="student-view-exit">
          <X size={15} aria-hidden />
          {sv.tenta.studentViewExit}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="basis-full text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
