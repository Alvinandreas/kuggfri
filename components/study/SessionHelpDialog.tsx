"use client";

import Link from "next/link";
import { Flag, Star, Volume2 } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { SELF_RATINGS } from "@/lib/progress/types";
import { Kbd } from "@/components/ui/Kbd";
import { Modal } from "@/components/ui/Modal";
import { cx } from "@/components/ui/cx";
import { ratingClass } from "./RatingButtons";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="font-bold">{title}</h3>
      {children}
    </section>
  );
}

/** Instruktionerna bakom info-knappen i passet: vända, skatta, tangentbordet och knapparna. */
export function SessionHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={sv.session.helpTitle} size="md">
      <div className="grid gap-6 text-sm" data-testid="session-help">
        <Section title={sv.session.helpFlipTitle}>
          <p className="text-muted">{sv.session.helpFlip}</p>
        </Section>

        <Section title={sv.session.helpRateTitle}>
          <p className="text-muted">{sv.session.helpRate}</p>
          <ul className="mt-1 grid gap-2">
            {SELF_RATINGS.map((r) => (
              <li key={r} className="flex items-center gap-3">
                <span className={cx("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 font-extrabold", ratingClass[r])}>{r}</span>
                <span>
                  <span className="block font-semibold">{sv.study.rate[r]}</span>
                  <span className="block text-muted">{sv.session.rateMeaning[r]}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={sv.session.helpKeysTitle}>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
            {sv.session.keys.map(([key, what]) => (
              <div key={key} className="contents">
                <dt>
                  <Kbd className="h-7 min-w-9 px-2 text-xs">{key}</Kbd>
                </dt>
                <dd className="text-muted">{what}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted">{sv.session.helpSwipe}</p>
        </Section>

        <Section title={sv.session.helpButtonsTitle}>
          <ul className="grid gap-2 text-muted">
            <li className="flex gap-3">
              <Star size={18} aria-hidden className="mt-0.5 shrink-0 text-fg" />
              {sv.session.helpStar}
            </li>
            <li className="flex gap-3">
              <Volume2 size={18} aria-hidden className="mt-0.5 shrink-0 text-fg" />
              {sv.session.helpSound}
            </li>
            <li className="flex gap-3">
              <Flag size={18} aria-hidden className="mt-0.5 shrink-0 text-fg" />
              {sv.session.helpReport}
            </li>
          </ul>
        </Section>

        <p className="text-muted">
          <Link href="/hjalp" className="font-semibold text-accent underline-offset-2 hover:underline">
            {sv.session.helpSchedule}
          </Link>
        </p>
      </div>
    </Modal>
  );
}
