"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { useTheme, type Theme } from "@/lib/ui/theme";

const ORDER: Theme[] = ["system", "light", "dark"];

/** Kompakt knapp som stegar mellan systemets, ljust och mörkt läge (sajtens sidhuvud). */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const label = sv.theme[theme];
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? "system")}
      aria-label={`${sv.theme.label}: ${label}`}
      title={`${sv.theme.label}: ${label}`}
      className="relative ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors after:absolute after:-inset-1 hover:bg-surface-2 hover:text-fg"
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden />
    </button>
  );
}

/**
 * Tre lägen sida vid sida, för profilmenyn och kontosidan. inMenu gör knapparna till
 * menyposter (menuitemradio) så att piltangenterna i menyn når dem.
 */
export function ThemeSwitcher({ className = "", inMenu = false }: { className?: string; inMenu?: boolean }) {
  const [theme, setTheme] = useTheme();
  const options: Array<{ value: Theme; Icon: typeof Sun }> = [
    { value: "system", Icon: Monitor },
    { value: "light", Icon: Sun },
    { value: "dark", Icon: Moon },
  ];
  return (
    <div role={inMenu ? "none" : "radiogroup"} aria-label={inMenu ? undefined : sv.theme.label} className={`inline-flex rounded-full bg-surface-2 p-0.5 ${className}`.trim()}>
      {options.map(({ value, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role={inMenu ? "menuitemradio" : "radio"}
            tabIndex={inMenu ? -1 : undefined}
            aria-checked={active}
            aria-label={sv.theme[value]}
            title={sv.theme[value]}
            onClick={() => setTheme(value)}
            className={`inline-flex h-7 w-9 items-center justify-center rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
              active ? "bg-inverse text-inverse-fg" : "text-muted hover:text-fg"
            }`}
          >
            <Icon size={15} strokeWidth={2} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
