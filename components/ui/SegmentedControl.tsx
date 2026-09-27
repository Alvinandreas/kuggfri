"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { cx } from "./cx";

export type Segment<T extends string> = { value: T; label: string; href?: string };

type Props<T extends string> = {
  segments: Array<Segment<T>>;
  value: T;
  onChange?: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  /** "raised" på en redan grå yta (t.ex. inne i ett inställningsblock), så att spåret syns. */
  tone?: "default" | "raised";
  className?: string;
};

/**
 * Flikar i en pill ("Skapa / Resurser" hos Knowt). Den valda fliken markeras av en
 * pill som glider mellan lägena. Segment med href blir länkar (vyer med egna adresser),
 * annars knappar som anropar onChange.
 */
export function SegmentedControl<T extends string>({ segments, value, onChange, label, size = "md", tone = "default", className }: Props<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const el = wrap.querySelector<HTMLElement>(`[data-segment="${CSS.escape(value)}"]`);
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    // Första placeringen sker utan glid; därefter animeras bytena.
    const id = requestAnimationFrame(() => setAnimate(true));
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [value, segments]);

  const item = cx(
    "relative z-10 inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-semibold transition-colors duration-200",
    size === "sm" ? "h-8 px-3.5 text-sm" : "h-10 px-5 text-[0.95rem]",
  );

  return (
    <div ref={wrapRef} role="group" aria-label={label} className={cx("relative inline-flex rounded-full p-1", tone === "raised" ? "bg-surface dark:bg-surface-3" : "bg-surface-2", className)}>
      {pill ? (
        <span
          aria-hidden
          className={cx("absolute bottom-1 top-1 left-0 rounded-full bg-inverse", animate && "transition-[transform,width] duration-300 ease-out")}
          style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
        />
      ) : null}
      {segments.map((s) => {
        const active = s.value === value;
        const cls = cx(item, active ? "text-inverse-fg" : "text-muted hover:text-fg", !pill && active && "bg-inverse");
        return s.href ? (
          <Link key={s.value} href={s.href} data-segment={s.value} aria-current={active ? "page" : undefined} className={cls}>
            {s.label}
          </Link>
        ) : (
          <button key={s.value} type="button" data-segment={s.value} aria-pressed={active} onClick={() => onChange?.(s.value)} className={cls}>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
