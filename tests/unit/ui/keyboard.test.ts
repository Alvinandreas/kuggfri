// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { shouldIgnoreShortcut, type ShortcutGuard } from "@/lib/ui/keyboard";

/** Skickar en keydown från target (bubblar till window) och svarar vad vakten säger där. */
function check(target: EventTarget, options: ShortcutGuard, init: KeyboardEventInit = {}, prevent = false): boolean {
  let result: boolean | null = null;
  const onKey = (e: KeyboardEvent) => {
    result = shouldIgnoreShortcut(e, options);
  };
  window.addEventListener("keydown", onKey);
  const e = new KeyboardEvent("keydown", { key: "j", bubbles: true, cancelable: true, ...init });
  if (prevent) e.preventDefault();
  target.dispatchEvent(e);
  window.removeEventListener("keydown", onKey);
  if (result === null) throw new Error("ingen keydown");
  return result;
}

function add<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, parent: HTMLElement = document.body): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

// Inkorgens lista och granskningsvyns kort (selektorerna som de står i komponenterna).
const LIST = { handled: true, modifiers: true, selector: 'input, textarea, [role="combobox"], [role="listbox"], [role="menu"], dialog', openDialog: true } satisfies ShortcutGuard;
const CARD = {
  handled: true,
  repeat: true,
  selector: 'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="menu"], dialog',
  openDialog: true,
} satisfies ShortcutGuard;

describe("shouldIgnoreShortcut", () => {
  it("utan valda kontroller ignoreras inget", () => {
    expect(check(add("input"), {}, { ctrlKey: true, repeat: true }, true)).toBe(false);
  });

  it("en vanlig tangent på sidan räknas", () => {
    expect(check(document.body, LIST)).toBe(false);
    expect(check(document.body, CARD)).toBe(false);
  });

  it("handled: redan hanterad tangent ignoreras", () => {
    expect(check(document.body, { handled: true }, {}, true)).toBe(true);
    expect(check(document.body, { handled: true })).toBe(false);
  });

  it("repeat: nedhållen tangent ignoreras bara när den är vald", () => {
    expect(check(document.body, CARD, { repeat: true })).toBe(true);
    expect(check(document.body, LIST, { repeat: true })).toBe(false);
  });

  it("modifiers: Ctrl, Cmd och Alt ignoreras bara när den är vald (Shift räknas)", () => {
    for (const mod of ["ctrlKey", "metaKey", "altKey"] as const) {
      expect(check(document.body, LIST, { [mod]: true })).toBe(true);
      expect(check(document.body, CARD, { [mod]: true })).toBe(false);
    }
    expect(check(document.body, LIST, { shiftKey: true })).toBe(false);
  });

  it("selector: fält, listor och menyer, också inuti dem", () => {
    expect(check(add("input"), LIST)).toBe(true);
    expect(check(add("textarea"), LIST)).toBe(true);
    const menu = add("div", { role: "menu" });
    expect(check(add("button", {}, menu), LIST)).toBe(true);
    expect(check(add("div", { role: "listbox" }), CARD)).toBe(true);
    expect(check(add("button"), LIST)).toBe(false);
  });

  it("selector: select och contenteditable bara i kortvyns selektor", () => {
    const select = add("select");
    expect(check(select, CARD)).toBe(true);
    expect(check(select, LIST)).toBe(false);
    const editable = add("div", { contenteditable: "true" });
    expect(check(editable, CARD)).toBe(true);
    expect(check(editable, LIST)).toBe(false);
  });

  it("openDialog: en öppen dialog någonstans stoppar tangenterna", () => {
    const button = add("button");
    add("dialog", { open: "" });
    expect(check(button, LIST)).toBe(true);
    expect(check(button, CARD)).toBe(true);
    expect(check(button, { selector: "input" })).toBe(false);
  });

  it("openDialog: en stängd dialog stoppar inte", () => {
    const button = add("button");
    add("dialog");
    expect(check(button, LIST)).toBe(false);
  });

  it("formFields: formulärfält efter tagg och redigerbart innehåll (studievyns regel)", () => {
    expect(check(add("input"), { formFields: true })).toBe(true);
    expect(check(add("textarea"), { formFields: true })).toBe(true);
    expect(check(add("select"), { formFields: true })).toBe(true);
    const editable = add("div", { contenteditable: "true" });
    // jsdom räknar inte ut isContentEditable; sätt den som webbläsaren gör.
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(check(editable, { formFields: true })).toBe(true);
    // Inte inuti: ett fält som förälder räknas inte, och inte roller eller dialoger.
    const menu = add("div", { role: "menu" });
    expect(check(add("button", {}, menu), { formFields: true })).toBe(false);
    expect(check(document.body, { formFields: true })).toBe(false);
  });

  it("formFields: ett mål som inte är ett element ignoreras inte", () => {
    expect(check(window, { formFields: true })).toBe(false);
  });
});
