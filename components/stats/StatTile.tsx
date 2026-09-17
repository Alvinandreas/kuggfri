import Link from "next/link";

export type StatTone = "green" | "navy" | "teal" | "violet";

// Samma mjuka skala som kategoritaggarna: grön (accent), blå (tag-7), turkos (tag-5), violett (tag-8).
const tones: Record<StatTone, string> = {
  green: "border-accent/40 bg-accent-soft/60",
  navy: "border-tag-7 bg-tag-7/60 dark:bg-tag-7/35",
  teal: "border-tag-5 bg-tag-5/60 dark:bg-tag-5/35",
  violet: "border-tag-8 bg-tag-8/60 dark:bg-tag-8/35",
};

type Props = {
  label: string;
  value: string;
  sub: string;
  tone: StatTone;
  help?: string;
  /** Gör hela rutan klickbar. Länken ligger i dd:t eftersom en <dl> bara får innehålla div/dt/dd. */
  href?: string;
  testId?: string;
};

/** Nyckeltalsruta i en <dl>. Används på studentens decksida och i examinatorns kursöversikt. */
export function StatTile({ label, value, sub, tone, help, href, testId }: Props) {
  return (
    <div className={`relative rounded-lg border p-3 ${tones[tone]} ${href ? "transition-shadow hover:shadow-card" : ""}`}>
      <dt className="text-xs text-muted" title={help}>
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold leading-none tabular-nums" data-testid={testId}>
        {href ? (
          <Link href={href} className="after:absolute after:inset-0 after:rounded-lg">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
      <dd className="mt-1 text-xs text-muted">{sub}</dd>
    </div>
  );
}
