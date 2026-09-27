import { cx } from "./cx";

/** Initialer ur ett namn eller en e-postadress: "Alvin Andreasson" → "AA", "alvin@x.se" → "A". */
export function initials(name: string): string {
  const words = name.split("@")[0]!.split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]![0], words[words.length - 1]![0]] : [words[0]?.[0]];
  return letters.filter(Boolean).join("").toUpperCase() || "?";
}

/** Rund profilmarkör med initialer. Dekorativ: namnet står alltid bredvid eller i en etikett. */
export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 select-none items-center justify-center rounded-full bg-accent-soft font-bold text-accent-ink", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}
