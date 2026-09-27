import Link from "next/link";
import { cx } from "@/components/ui/cx";

export type StatTone = "green" | "navy" | "teal" | "violet";

// En liten färgprick per nyckeltal i stället för färgade rutor: lugnare, och samma
// diagramfärger som resten av statistiken.
const dots: Record<StatTone, string> = {
  green: "bg-accent",
  navy: "bg-chart-2",
  teal: "bg-chart-3",
  violet: "bg-chart-4",
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
  /** "inset" inne i ett block (standard), "card" som eget block direkt på duken. */
  variant?: "inset" | "card";
};

/** Nyckeltalsruta i en <dl>. Används på hemsidan, decksidan, sammanfattningen och i kursöversikten. */
export function StatTile({ label, value, sub, tone, help, href, testId, variant = "inset" }: Props) {
  return (
    <div
      className={cx(
        "relative rounded-lg p-4",
        variant === "inset" ? "bg-surface-2" : "border border-line bg-surface dark:border-transparent",
        href && "transition-colors hover:bg-surface-3",
      )}
    >
      <dt className="flex items-center gap-2 text-xs font-semibold text-muted" title={help}>
        <span aria-hidden className={cx("h-2 w-2 shrink-0 rounded-full", dots[tone])} />
        {label}
      </dt>
      <dd className="mt-2 text-3xl font-extrabold leading-none tracking-tight tabular-nums" data-testid={testId}>
        {href ? (
          <Link href={href} className="after:absolute after:inset-0 after:rounded-lg">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
      <dd className="mt-1.5 text-xs text-muted">{sub}</dd>
    </div>
  );
}
