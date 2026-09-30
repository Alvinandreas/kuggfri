"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useAnchoredPopup } from "@/lib/ui/anchor";
import { cx } from "./cx";

export type SelectOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SelectOption<T>>;
  /** Tillgängligt namn när ingen <label htmlFor> pekar hit. */
  label?: string;
  id?: string;
  /** Skickar värdet med i ett formulär som ett dolt fält. */
  name?: string;
  /** Bara så bred som innehållet, i stället för hela bredden. */
  fit?: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
};

/**
 * Rullgardin i designsystemets stil: en fältliknande knapp och en lista som poppar fram
 * som profilmenyn, i stället för webbläsarens egen. Tangentbord som en vanlig select:
 * pilar, Home/End, Enter/blanksteg väljer, Esc stänger, bokstäver hoppar till alternativ.
 */
export function Select<T extends string>({ value, onChange, options, label, id, name, fit = false, size = "md", disabled, className, ...rest }: Props<T>) {
  const autoId = useId();
  const buttonId = id ?? autoId;
  const listId = `${buttonId}-lista`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef({ text: "", at: 0 });
  /** Listan har öppnats men fokus har ännu inte flyttats in i den. */
  const focusPending = useRef(false);
  const style = useAnchoredPopup(triggerRef, open, options.length * 40 + 12);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  function openList() {
    if (disabled) return;
    setActive(selectedIndex);
    focusPending.current = true;
    setOpen(true);
  }

  function close(focusButton = true) {
    setOpen(false);
    if (focusButton) triggerRef.current?.focus();
  }

  function choose(i: number) {
    const o = options[i];
    if (o && o.value !== value) onChange(o.value);
    close();
  }

  // Fokus flyttas in när listan väl finns: första gången saknas positionen (style) ett ögonblick,
  // och då blev fokus kvar på knappen så att varken piltangenterna eller Esc fungerade.
  useEffect(() => {
    if (!open || !style || !focusPending.current) return;
    const raf = requestAnimationFrame(() => {
      focusPending.current = false;
      listRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, style]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // Håll det aktiva alternativet synligt i en lång lista.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function typeahead(key: string) {
    const now = Date.now();
    typed.current = { text: now - typed.current.at < 700 ? typed.current.text + key.toLowerCase() : key.toLowerCase(), at: now };
    const start = typed.current.text.length === 1 ? active + 1 : active;
    for (let k = 0; k < options.length; k++) {
      const i = (start + k) % options.length;
      if (options[i]!.label.toLowerCase().startsWith(typed.current.text)) return i;
    }
    return null;
  }

  function onButtonKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (open && e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  }

  function onListKey(e: KeyboardEvent<HTMLUListElement>) {
    const last = options.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      setActive(Math.max(0, Math.min(last, i)));
    };
    if (e.key === "ArrowDown") move(active + 1);
    else if (e.key === "ArrowUp") move(active - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(last);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      e.preventDefault();
      close();
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const hit = typeahead(e.key);
      if (hit !== null) move(hit);
    }
  }

  return (
    <span className={cx("relative", fit ? "inline-block" : "block w-full", className)}>
      <button
        ref={triggerRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        disabled={disabled}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onButtonKey}
        data-value={value}
        {...rest}
        className={cx(
          "flex w-full min-w-0 items-center justify-between gap-3 rounded-md border bg-surface-2 text-left font-medium text-fg transition-[border-color,background-color,box-shadow] duration-150",
          "hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50",
          open ? "border-accent ring-4 ring-accent/15" : "border-transparent",
          size === "sm" ? "h-9 pl-3 pr-2.5 text-sm" : "h-12 pl-4 pr-3",
        )}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown size={size === "sm" ? 15 : 17} aria-hidden className={cx("shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} />
      </button>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {open && style
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-labelledby={label ? undefined : buttonId}
              aria-label={label}
              aria-activedescendant={`${listId}-${active}`}
              onKeyDown={onListKey}
              style={style}
              className="anim-pop fixed z-[60] overflow-y-auto rounded-lg border border-line bg-surface p-1.5 text-fg shadow-pop outline-none"
            >
              {options.map((o, i) => {
                const isSelected = o.value === value;
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    onPointerMove={() => setActive(i)}
                    onClick={() => choose(i)}
                    className={cx(
                      "flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-[0.95rem]",
                      i === active ? "bg-surface-2" : "",
                      isSelected ? "font-semibold" : "font-medium",
                    )}
                  >
                    <span className="min-w-0">{o.label}</span>
                    {isSelected ? <Check size={16} aria-hidden className="shrink-0 text-accent" /> : <span className="w-4 shrink-0" />}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </span>
  );
}
