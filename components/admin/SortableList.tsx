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
import { sv } from "@/lib/i18n/sv";

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`relative flex items-center gap-2 rounded-md border border-line bg-surface p-2 transition-colors ${
        href ? "hover:border-line-strong hover:bg-surface-2 focus-within:border-line-strong" : ""
      } ${isDragging ? "opacity-70 shadow-card" : ""}`}
    >
      {href ? (
        // Täcker hela raden så att den är klickbar överallt; knapparna ligger ovanpå (z-10).
        <Link href={href} aria-label={hrefLabel} data-testid={linkTestId} className="absolute inset-0 rounded-md focus-visible:outline-2 focus-visible:outline-accent" />
      ) : null}
      <button
        type="button"
        aria-label={sv.admin.dragHandle}
        title={sv.admin.dragHandle}
        className="relative z-10 cursor-grab touch-none rounded px-1 py-1 text-muted hover:text-fg"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <div className="relative z-10 min-w-0 flex-1 pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_form]:pointer-events-auto [&_input]:pointer-events-auto">
        {children}
      </div>
      <div className="relative z-10 flex flex-col">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          aria-label={sv.admin.moveUp}
          className="rounded px-1 text-muted hover:text-fg disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={index === count - 1}
          aria-label={sv.admin.moveDown}
          className="rounded px-1 text-muted hover:text-fg disabled:opacity-30"
        >
          ↓
        </button>
      </div>
    </li>
  );
}
