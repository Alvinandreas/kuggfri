import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { moveItem, newOptionKey, type OptionDraft } from "@/lib/admin/card-form";
import { LIMITS } from "@/lib/admin/limits";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { inputClass } from "@/components/ui/TextField";
import { cx } from "@/components/ui/cx";

/** Redigerbar lista med svarsalternativ: text, rätt/fel, flytta och ta bort. Används också i granskningen. */
export function OptionsEditor({ items, onChange }: { items: OptionDraft[]; onChange: (next: OptionDraft[]) => void }) {
  const update = (key: string, patch: Partial<OptionDraft>) => onChange(items.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  return (
    <fieldset className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2" data-testid="card-options">
      <legend className="mb-1 text-sm font-semibold">{sv.admin.alternatives}</legend>
      <p className="-mt-1 mb-1 text-sm text-muted">{sv.admin.alternativesHelp}</p>
      <ol className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {items.map((o, i) => (
          <li key={o.key} className={cx("flex items-start gap-2 rounded-md border-2 p-1.5 pl-3 transition-colors duration-150", o.correct ? "border-accent/60 bg-accent-soft/40" : "border-transparent bg-surface-2")}>
            <label className="flex h-10 shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold">
              <Checkbox checked={o.correct} onChange={(e) => update(o.key, { correct: e.target.checked })} aria-label={`${sv.admin.correctOption}: ${sv.admin.alternativeLabel(i + 1)}`} />
              <span aria-hidden className="hidden w-8 sm:inline">
                {sv.admin.correctOption}
              </span>
            </label>
            {/* Växer med texten, så att långa alternativ går att läsa i sin helhet. Ett alternativ är
                en rad: Enter infogar ingen radbrytning (Ctrl+Enter sparar som i resten av formuläret). */}
            <textarea
              value={o.text}
              onChange={(e) => update(o.key, { text: e.target.value.replace(/\r?\n/g, " ") })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) e.preventDefault();
              }}
              rows={1}
              aria-label={sv.admin.alternativeLabel(i + 1)}
              placeholder={sv.admin.alternativeLabel(i + 1)}
              maxLength={LIMITS.optionText}
              className={cx(inputClass, "field-sizing-content min-h-10 min-w-0 flex-1 resize-none bg-surface! px-3 py-2 leading-snug dark:bg-surface-3!")}
            />
            <div className="flex h-10 shrink-0 items-center">
              <IconButton label={sv.admin.moveAlternativeUp(i + 1)} size="sm" onClick={() => onChange(moveItem(items, i, -1))} disabled={i === 0}>
                <ArrowUp size={15} aria-hidden />
              </IconButton>
              <IconButton label={sv.admin.moveAlternativeDown(i + 1)} size="sm" onClick={() => onChange(moveItem(items, i, 1))} disabled={i === items.length - 1}>
                <ArrowDown size={15} aria-hidden />
              </IconButton>
              <IconButton label={sv.admin.removeAlternative(i + 1)} size="sm" onClick={() => onChange(items.filter((x) => x.key !== o.key))} disabled={items.length <= 2}>
                <X size={15} aria-hidden />
              </IconButton>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...items, { key: newOptionKey(), text: "", correct: false }])}
          disabled={items.length >= LIMITS.maxOptions}
        >
          <Plus size={15} aria-hidden />
          {sv.admin.addAlternative}
        </Button>
      </div>
    </fieldset>
  );
}
