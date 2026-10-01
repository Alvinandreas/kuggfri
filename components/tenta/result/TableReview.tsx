import { Check, CircleMinus, X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { Markdown } from "@/components/markdown/Markdown";
import { cx } from "@/components/ui/cx";
import { inlineMarkdown } from "../markdownClasses";

function Mark({ ok, blank }: { ok: boolean; blank?: boolean }) {
  if (blank) return <CircleMinus size={16} aria-label={sv.tenta.outcome.obesvarad} className="text-muted" />;
  return ok ? <Check size={16} strokeWidth={2.6} aria-label={sv.tenta.outcome.ratt} className="text-accent" /> : <X size={16} strokeWidth={2.6} aria-label={sv.tenta.outcome.fel} className="text-danger" />;
}

export function TableReview({ rows, head }: { rows: { prompt: string; mine: string | null; right: string; ok: boolean }[]; head: string }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-left text-[0.95rem]">
        <thead>
          <tr className="text-sm text-muted">
            <th scope="col" className="pb-2 pr-3 font-semibold">
              {head}
            </th>
            <th scope="col" className="pb-2 pr-3 font-semibold">
              {sv.tenta.yourAnswer}
            </th>
            <th scope="col" className="pb-2 pr-3 font-semibold">
              {sv.tenta.correctAnswer}
            </th>
            <th scope="col" className="w-8 pb-2">
              <span className="sr-only">{sv.tenta.resultTitle}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cx("border-t border-line align-top", !r.ok && r.mine !== null && "bg-danger-soft/40")}>
              <td className="py-2.5 pr-3">
                <Markdown text={r.prompt} variant="body" className={inlineMarkdown} />
              </td>
              <td className={cx("py-2.5 pr-3 font-medium", r.mine === null && "text-muted", !r.ok && r.mine !== null && "text-danger")}>{r.mine ?? sv.tenta.noAnswer}</td>
              <td className="py-2.5 pr-3 font-medium text-accent-ink">{r.right}</td>
              <td className="py-2.5">
                <Mark ok={r.ok} blank={r.mine === null} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
