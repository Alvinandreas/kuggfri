"use client";

import { Star } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useStars } from "@/lib/progress/stars";
import { firstLine } from "@/lib/text/first-line";
import { IconButton } from "@/components/ui/Button";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Modal } from "@/components/ui/Modal";

type Card = { id: string; category_id: string | null; front: string };

/**
 * Alla stjärnmärkta kort i kursen: frågan och kategorin, i kursens ordning, med stjärnan
 * kvar så att ett kort kan tas bort ur listan direkt.
 */
export function StarredDialog({
  open,
  onClose,
  cards,
  categories,
  colorIndex,
}: {
  open: boolean;
  onClose: () => void;
  cards: readonly Card[];
  categories: readonly { id: string; title: string }[];
  colorIndex: Map<string, number>;
}) {
  const sv = useT();
  const { stars, toggle } = useStars();
  const starred = cards.filter((c) => stars.has(c.id));
  const titleOf = new Map(categories.map((c) => [c.id, c.title] as const));

  return (
    <Modal open={open} onClose={onClose} title={sv.session.starredTitle} size="lg">
      {starred.length === 0 ? (
        <p className="text-muted">{sv.session.starredEmpty}</p>
      ) : (
        <div className="grid gap-3" data-testid="starred-list">
          <p className="text-sm text-muted">{sv.session.starredHelp}</p>
          <ul className="grid gap-2">
            {starred.map((c) => (
              <li key={c.id} className="flex items-start gap-3 rounded-lg bg-surface-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  {c.category_id && titleOf.has(c.category_id) ? (
                    <CategoryTag title={titleOf.get(c.category_id) ?? ""} colorIndex={colorIndex.get(c.category_id) ?? 0} />
                  ) : null}
                  <p className="mt-1.5 font-medium">{firstLine(c.front)}</p>
                </div>
                <IconButton
                  label={sv.session.unstar}
                  variant="ghost"
                  size="sm"
                  onClick={() => toggle(c.id)}
                  style={{ color: "var(--chart-3)" }}
                >
                  <Star size={17} aria-hidden fill="currentColor" />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
