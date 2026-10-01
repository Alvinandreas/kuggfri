import { Check, X } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { ExamQuestion } from "@/lib/tentor/model";
import { formatPoints } from "@/lib/tentor/session";
import { Markdown } from "@/components/markdown/Markdown";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { inlineMarkdownKey } from "./markdownClasses";

/** Facit för en uppgift i examinatorns facitvy: rätta alternativ, påståenden, par eller värde. */
export async function ExamKey({ q }: { q: ExamQuestion }) {
  const sv = await getT();
  if (q.noKey) return <p className="text-sm font-semibold text-danger">{sv.tenta.noKey}</p>;
  switch (q.kind) {
    case "flerval":
    case "flera":
      return (
        <ul className="grid gap-1.5">
          {(q.options ?? []).map((o, i) => (
            <li key={i} className={cx("flex items-start gap-2.5 rounded-md border px-3 py-2", o.correct ? "border-accent bg-accent-soft/60" : "border-line")}>
              {o.correct ? <Check size={16} strokeWidth={2.6} aria-label={sv.tenta.correctAnswer} className="mt-1 shrink-0 text-accent" /> : <X size={16} aria-hidden className="mt-1 shrink-0 text-subtle" />}
              <Markdown text={o.text} variant="body" className={cx("min-w-0 flex-1", inlineMarkdownKey)} />
            </li>
          ))}
        </ul>
      );
    case "sant-falskt":
      return (
        <ul className="grid gap-1.5">
          {(q.statements ?? []).map((s, i) => (
            <li key={i} className="flex items-start gap-3 rounded-md border border-line px-3 py-2">
              <Badge tone={s.answer ? "accent" : "danger"} className="mt-0.5 shrink-0">
                {s.answer ? sv.tenta.trueLabel : sv.tenta.falseLabel}
              </Badge>
              <Markdown text={s.text} variant="body" className={cx("min-w-0 flex-1", inlineMarkdownKey)} />
            </li>
          ))}
        </ul>
      );
    case "para":
      return (
        <div className="grid gap-2">
          {q.choices?.length ? <p className="text-sm text-muted">{q.choices.join(" | ")}</p> : <p className="text-sm text-muted">{sv.tenta.ownLists}</p>}
          <ul className="grid gap-1.5">
            {(q.pairs ?? []).map((p, i) => (
              <li key={i} className="grid gap-1 rounded-md border border-line px-3 py-2 sm:grid-cols-[minmax(0,1fr)_14rem] sm:gap-4">
                <div className="min-w-0">
                  <Markdown text={p.prompt} variant="body" className={inlineMarkdownKey} />
                  {p.choices?.length ? <p className="mt-0.5 text-sm text-muted">{p.choices.join(" | ")}</p> : null}
                </div>
                <span className="font-semibold text-accent-ink">{p.answer}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "numerisk": {
      const k = q.numeric;
      if (!k) return null;
      const tol = k.relative ? sv.meta.pct(formatPoints(k.tolerance * 100, sv.meta.locale)) : formatPoints(k.tolerance, sv.meta.locale);
      return (
        <p className="text-lg font-bold tabular-nums text-accent-ink">
          {formatPoints(k.value, sv.meta.locale)}
          {k.unit && k.unit !== "-" ? ` ${k.unit}` : ""} <span className="text-sm font-medium text-muted">{sv.tenta.tolerance(tol)}</span>
        </p>
      );
    }
    case "text":
      return null;
  }
}
