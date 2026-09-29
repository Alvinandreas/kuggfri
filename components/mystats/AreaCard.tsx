import Link from "next/link";
import { Target, Trophy } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import type { RankedArea } from "@/lib/stats/my-stats";
import { Card, CardHeader } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { ProgressBar } from "@/components/ui/ProgressBar";

export type AreaItem = {
  key: string;
  title: string;
  /** Kategorins plats i sin kurs: samma färg som taggen överallt annars. */
  colorIndex: number;
  href: string;
  /** Kursens namn när flera kurser visas samtidigt. */
  deckTitle: string | null;
  learned: number;
  total: number;
};

/** Starkaste eller svagaste områdena: tagg, andel inlärda och en länk till kursen. */
export function AreaCard({ kind, items, index }: { kind: "strongest" | "weakest"; items: RankedArea<AreaItem>[]; index: number }) {
  const strong = kind === "strongest";
  const Icon = strong ? Trophy : Target;
  return (
    <Card padding="lg" className="anim-fade-up flex flex-col" style={{ ["--i" as string]: index }} data-testid={`mystats-${kind}`}>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Icon size={18} aria-hidden className={strong ? "text-chart-3" : "text-chart-2"} />
            {strong ? sv.myStats.strongest : sv.myStats.weakest}
          </span>
        }
        description={strong ? sv.myStats.strongestHelp : sv.myStats.weakestHelp}
        spacing="sm"
      />
      {items.length === 0 ? (
        <p className="text-sm text-muted">{strong ? sv.myStats.strongestEmpty : sv.myStats.weakestEmpty}</p>
      ) : (
        <ol className="-mx-3 grid gap-1">
          {items.map((a) => (
            <li key={a.key}>
              <Link href={a.href} className="block rounded-md px-3 py-3 transition-colors hover:bg-surface-2">
                <div className="flex items-center justify-between gap-3">
                  <CategoryTag title={a.title} colorIndex={a.colorIndex} className="min-w-0" />
                  <span className="shrink-0 text-sm font-bold tabular-nums">{Math.round(a.share * 100)} %</span>
                </div>
                <ProgressBar value={a.share} label={`${sv.myStats.learned}: ${a.title}`} className="mt-2.5" />
                <p className="mt-1.5 text-xs text-muted">
                  {[sv.myStats.areaLearned(a.learned, a.total), a.deckTitle].filter(Boolean).join(", ")}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
