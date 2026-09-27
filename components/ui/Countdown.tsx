"use client";

import { useEffect, useState } from "react";
import { cx } from "./cx";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 60_000));
  return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 };
}

/**
 * Tid kvar till ett datum i en pill: "7 dagar 20 tim 42 min". Uppdateras varje minut.
 * Renderas först utan siffror på servern så att klientens klocka avgör (ingen hydreringskrock).
 */
export function Countdown({ to, label, className }: { to: string | Date; label: string; className?: string }) {
  const target = typeof to === "string" ? new Date(to).getTime() : to.getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const p = now === null ? null : parts(target - now);
  const unit = (n: number, one: string, many: string) => (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-lg font-bold tabular-nums">{n}</span>
      <span className="text-sm text-muted">{n === 1 ? one : many}</span>
    </span>
  );
  return (
    <span
      role="timer"
      aria-label={p ? `${label}: ${p.days} dagar, ${p.hours} timmar och ${p.minutes} minuter` : label}
      className={cx("inline-flex h-11 items-center gap-3 rounded-full border border-line-strong px-4", className)}
    >
      {p ? (
        <>
          {unit(p.days, "dag", "dagar")}
          {unit(p.hours, "tim", "tim")}
          {unit(p.minutes, "min", "min")}
        </>
      ) : (
        <span className="text-sm text-muted">…</span>
      )}
    </span>
  );
}
