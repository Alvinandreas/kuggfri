"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { sv } from "@/lib/i18n/sv";

type Props<T extends { id: string }> = {
  items: T[];
  label: string;
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T) => ReactNode;
};

/**
 * Sorterbar lista med drag-and-drop (pekare och tangentbord via dnd-kit)
 * samt Flytta upp/ner-knappar som alltid fungerar.
 */
export function SortableList<T extends { id: string }>({ items, label, onReorder, renderItem }: Props<T>) {
  const [order, setOrder] = useState(items);
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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul aria-label={label} className="grid gap-2">
          {order.map((item, index) => (
            <SortableRow key={item.id} id={item.id} index={index} count={order.length} onMove={move}>
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
  children,
}: {
  id: string;
  index: number;
  count: number;
  onMove: (index: number, delta: -1 | 1) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded-md border border-line bg-surface p-2 ${isDragging ? "opacity-70 shadow-card" : ""}`}
    >
      <button
        type="button"
        aria-label={sv.admin.dragHandle}
        title={sv.admin.dragHandle}
        className="mt-1 cursor-grab touch-none rounded px-1 text-muted hover:text-fg"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex flex-col">
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
