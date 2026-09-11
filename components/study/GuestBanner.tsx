"use client";

import Link from "next/link";
import { useState } from "react";
import { sv } from "@/lib/i18n/sv";

/**
 * Diskret banner för gäster. Döljs bara för resten av sidvisningen; inget
 * sparas (localStorage används enbart för progress och tema).
 */
export function GuestBanner() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <aside
      aria-label={sv.guest.bannerTitle}
      className="mb-6 flex flex-col gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-muted">
        <span className="font-medium text-fg">{sv.guest.bannerTitle}</span> {sv.guest.bannerBody}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/registrera" className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-fg hover:bg-accent-hover">
          {sv.guest.bannerCta}
        </Link>
        <Link href="/logga-in" className="rounded-md px-3 py-1.5 text-fg hover:bg-surface">
          {sv.guest.bannerLogin}
        </Link>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label={sv.guest.bannerDismiss}
          className="rounded-md px-2 py-1.5 text-muted hover:text-fg"
        >
          ×
        </button>
      </div>
    </aside>
  );
}
