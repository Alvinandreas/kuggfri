"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cx } from "@/components/ui/cx";

/**
 * Små knappar i en rad (Byt namn, Ta bort). Egen hovring (surface-3) eftersom raden
 * själv blir surface-2 vid hovring. Minst 32 px höga, så klickytan räcker.
 */
export const rowActionClass =
  "inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 text-sm font-semibold text-muted transition-colors duration-150 hover:bg-surface-3 hover:text-fg disabled:pointer-events-none disabled:opacity-50 sm:px-3";

const iconAction =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-3 hover:text-fg disabled:pointer-events-none disabled:opacity-30";

type Props<T extends { id: string }> = {
  items: T[];
  label: string;
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T) => ReactNode;
  /** Om satt blir hela raden en länk (knappar i raden fungerar fortfarande). */
  href?: (item: T) => string;
  /** Tillgängligt namn på radlänken (t.ex. titeln). */
  hrefLabel?: (item: T) => string;
  linkTestId?: string;
};

/**
 * Sorterbar lista med drag-and-drop (pekare och tangentbord via dnd-kit)
 * samt Flytta upp/ner-knappar som alltid fungerar.
 */
export function SortableList<T extends { id: string }>({ items, label, onReorder, renderItem, href, hrefLabel, linkTestId }: Props<T>) {
  const [order, setOrder] = useState(items);
  // Stabilt id så att dnd-kits aria-describedby blir lika på server och klient.
  const dndId = useId();
  useEffect(() => setOrder(items), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function commit(next: T[]) {
    setOrder(next);
    onReorder(next.map((i) => i.id));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.findIndex((i) => i.id === active.id);
    const to = order.findIndex((i) => i.id === over.id);
    if (from === -1 || to === -1) return;
    commit(arrayMove(order, from, to));
  }

  function move(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= order.length) return;
    commit(arrayMove(order, index, to));
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul aria-label={label} className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {order.map((item, index) => (
            <SortableRow
              key={item.id}
              id={item.id}
              index={index}
              count={order.length}
              onMove={move}
              href={href?.(item)}
              hrefLabel={hrefLabel?.(item)}
              linkTestId={linkTestId}
            >
              {renderItem(item)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  index,
  count,
  onMove,
  href,
  hrefLabel,
  linkTestId,
  children,
}: {
  id: string;
  index: number;
  count: number;
  onMove: (index: number, delta: -1 | 1) => void;
  href?: string;
  hrefLabel?: string;
  linkTestId?: string;
  children: ReactNode;
}) {
  const sv = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cx(
        "relative flex min-h-14 items-center gap-1 rounded-lg border border-line bg-surface py-2 pl-4 pr-2 transition-colors duration-150 dark:border-transparent",
        href && "hover:bg-surface-2 focus-within:bg-surface-2",
        isDragging && "z-20 bg-surface-2 shadow-pop ring-2 ring-accent/30",
      )}
    >
      {href ? (
        // Täcker hela raden så att den är klickbar överallt; knapparna ligger ovanpå (z-10).
        <Link href={href} aria-label={hrefLabel} data-testid={linkTestId} className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
      ) : null}
      {/* Titeln ligger längst till vänster: den som trycker där träffar radlänken, inte ett handtag. */}
      <div className="relative z-10 min-w-0 flex-1 pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_form]:pointer-events-auto [&_input]:pointer-events-auto">
        {children}
      </div>
      <div className="relative z-10 flex shrink-0 items-center">
        <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={sv.admin.moveUp} title={sv.admin.moveUp} className={iconAction}>
          <ChevronUp size={17} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={index === count - 1}
          aria-label={sv.admin.moveDown}
          title={sv.admin.moveDown}
          className={iconAction}
        >
          <ChevronDown size={17} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={sv.admin.dragHandle}
          title={sv.admin.dragHandle}
          // På mobilen räcker pilarna (och ger plats åt titeln); handtaget finns från sm och uppåt.
          className={cx(iconAction, "cursor-grab touch-none active:cursor-grabbing max-sm:hidden")}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={17} aria-hidden />
        </button>
      </div>
    </li>
  );
}
