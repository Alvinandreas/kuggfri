"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cx } from "./cx";

export type MenuPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "right-end";

export type MenuTriggerProps = {
  ref: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
};

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"]), [role="menuitemradio"]';
const GAP = 8;
const EDGE = 8;

const MenuContext = createContext<{ close: (focusTrigger?: boolean) => void } | null>(null);

type Props = {
  /** Renderar knappen som öppnar menyn; sprid ut props på ett <button>. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  children: ReactNode;
  label: string;
  placement?: MenuPlacement;
  width?: string;
};

/**
 * Rullgardins- och popovermeny. Öppnas med klick, Enter, blanksteg eller pil; piltangenter,
 * Home och End flyttar mellan posterna; Esc stänger och lämnar fokus på knappen; klick
 * utanför stänger. Menyn renderas i en portal med fast position, så den klipps inte av
 * sidomenyns scrollyta, och poppar fram från den kant där knappen sitter.
 */
export function Menu({ trigger, children, label, placement = "bottom-start", width = "16rem" }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<"first" | "last">("first");
  const menuId = useId();

  const close = useCallback((focusTrigger = false) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // På smala skärmar finns ingen plats till höger: öppna uppåt i stället.
    const p: MenuPlacement = placement.startsWith("right") && vw < 640 ? "top-start" : placement;
    const s: Record<string, string | number> = {};
    if (p === "bottom-start" || p === "bottom-end") s.top = r.bottom + GAP;
    if (p === "top-start" || p === "top-end") s.bottom = vh - r.top + GAP;
    if (p === "right-start") s.top = r.top;
    if (p === "right-end") s.bottom = vh - r.bottom;
    if (p.endsWith("-end") && !p.startsWith("right")) s.right = vw - r.right;
    else if (p.startsWith("right")) s.left = r.right + GAP;
    else s.left = r.left;
    const vertical = p.startsWith("top") ? "bottom" : "top";
    const horizontal = p.endsWith("-end") && !p.startsWith("right") ? "right" : "left";
    s["--pop-origin"] = p.startsWith("right") ? `${horizontal} ${p === "right-end" ? "bottom" : "top"}` : `${horizontal} ${vertical}`;
    s["--pop-y"] = p.startsWith("top") ? "6px" : p.startsWith("bottom") ? "-6px" : "0px";
    setStyle(s as CSSProperties);
  }, [placement]);

  // Håll menyn inom skärmen när den är bredare än utrymmet (mobil).
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!open || !el || !style) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    // translate, inte transform: pop-animationen äger transform.
    if (r.right > vw - EDGE) el.style.translate = `${vw - EDGE - r.right}px 0`;
    else if (r.left < EDGE) el.style.translate = `${EDGE - r.left}px 0`;
  }, [open, style]);

  useEffect(() => {
    if (!open) return;
    place();
    const focusItem = () => {
      const items = menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
      if (!items || items.length === 0) return menuRef.current?.focus();
      (initialFocus.current === "last" ? items[items.length - 1] : items[0])?.focus();
    };
    const raf = requestAnimationFrame(focusItem);
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place, close]);

  function openWith(focus: "first" | "last") {
    initialFocus.current = focus;
    setOpen(true);
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openWith("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openWith("last");
    }
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      e.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowUp") move(i - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      // Menyn ligger sist i dokumentet: Tab skulle annars hoppa till sidans slut.
      e.preventDefault();
      close(true);
    }
  }

  return (
    <>
      {trigger({
        ref: (el) => {
          triggerRef.current = el;
        },
        onClick: () => (open ? close(false) : openWith("first")),
        onKeyDown: onTriggerKeyDown,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? menuId : undefined,
      })}
      {open && style
        ? createPortal(
            <MenuContext.Provider value={{ close }}>
              <div
                ref={menuRef}
                id={menuId}
                role="menu"
                aria-label={label}
                tabIndex={-1}
                onKeyDown={onMenuKeyDown}
                style={{ ...style, width, maxWidth: `calc(100vw - ${EDGE * 2}px)` }}
                className="anim-pop fixed z-[60] overflow-hidden rounded-lg border border-line bg-surface py-1.5 text-fg shadow-pop outline-none"
              >
                {children}
              </div>
            </MenuContext.Provider>,
            document.body,
          )
        : null}
    </>
  );
}

type ItemProps = {
  children: ReactNode;
  icon?: ReactNode;
  /** Något till höger: kortkommando, räknare, pil. */
  trailing?: ReactNode;
  href?: string;
  onSelect?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Låt menyn vara öppen efter valet. */
  keepOpen?: boolean;
};

export function MenuItem({ children, icon, trailing, href, onSelect, tone = "default", disabled, keepOpen }: ItemProps) {
  const ctx = useContext(MenuContext);
  const cls = cx(
    "mx-1.5 flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-left text-[0.95rem] font-medium outline-none transition-colors duration-100",
    "hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none",
    tone === "danger" ? "text-danger" : "text-fg",
    disabled && "pointer-events-none opacity-50",
  );
  const content = (
    <>
      {icon ? (
        <span aria-hidden className={cx("inline-flex w-5 shrink-0 justify-center", tone === "danger" ? "text-danger" : "text-muted")}>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing ? <span className="shrink-0 text-sm text-subtle">{trailing}</span> : null}
    </>
  );
  if (href && !disabled) {
    return (
      <Link href={href} role="menuitem" tabIndex={-1} className={cls} onClick={() => ctx?.close(false)}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      className={cx(cls, "w-[calc(100%-0.75rem)]")}
      onClick={() => {
        if (disabled) return;
        onSelect?.();
        if (!keepOpen) ctx?.close(true);
      }}
    >
      {content}
    </button>
  );
}

/** Ett icke-klickbart huvud överst i menyn, t.ex. namn och e-post. */
export function MenuHeader({ children }: { children: ReactNode }) {
  return <div className="-mt-1.5 mb-1.5 border-b border-line px-4 py-3">{children}</div>;
}

export function MenuSeparator() {
  return <div role="separator" className="my-1.5 h-px bg-line" />;
}

/** En rad med egen kontroll (t.ex. temaväljaren), i samma rytm som posterna. */
export function MenuRow({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="mx-1.5 flex min-h-10 items-center gap-3 px-3 py-1.5 text-[0.95rem] font-medium">
      {icon ? (
        <span aria-hidden className="inline-flex w-5 shrink-0 justify-center text-muted">
          {icon}
        </span>
      ) : null}
      <span className="flex-1">{label}</span>
      {children}
    </div>
  );
}
