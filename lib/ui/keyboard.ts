/**
 * Vakten för kortkommandon: när en tangent inte ska räknas som ett kommando för att man skriver,
 * står i en lista eller meny, har en dialog öppen eller håller ned en modifierare. Varje vy väljer
 * exakt vilka av kontrollerna den vill ha, så att vyernas olika regler kan uttryckas med samma
 * funktion.
 */
export type ShortcutGuard = {
  /** Tangenten har redan hanterats av något annat (defaultPrevented). */
  handled?: boolean;
  /** Tangenten hålls ned och upprepas. */
  repeat?: boolean;
  /** Ctrl, Cmd eller Alt är nedtryckt. */
  modifiers?: boolean;
  /** Målet är ett formulärfält (INPUT, TEXTAREA, SELECT) eller redigerbart (contenteditable). */
  formFields?: boolean;
  /** Målet ligger i ett element som matchar selektorn (closest), t.ex. fält, listor och menyer. */
  selector?: string;
  /** En dialog är öppen någonstans på sidan (dialog[open]). */
  openDialog?: boolean;
};

function isFormField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Sant om tangenten ska ignoreras som kortkommando enligt de valda kontrollerna. */
export function shouldIgnoreShortcut(e: KeyboardEvent, options: ShortcutGuard): boolean {
  if (options.handled && e.defaultPrevented) return true;
  if (options.repeat && e.repeat) return true;
  if (options.modifiers && (e.ctrlKey || e.metaKey || e.altKey)) return true;
  if (options.formFields && isFormField(e.target)) return true;
  if (options.selector && (e.target as HTMLElement | null)?.closest(options.selector)) return true;
  if (options.openDialog && document.querySelector("dialog[open]")) return true;
  return false;
}
