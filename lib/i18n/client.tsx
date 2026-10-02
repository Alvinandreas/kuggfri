"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { dictionary } from "./index";
import type { Dict, Lang } from "./types";

type LangState = { lang: Lang; setLang: (lang: Lang) => void };

const LangContext = createContext<LangState>({ lang: "sv", setLang: () => {} });

/**
 * Språket i klienten. Rotlayouten läser kontots språk och skickar in det, så att servern och
 * klienten renderar samma text. Byte (Konto → Språk): klienten byter direkt, valet sparas på
 * kontot (profiles.lang, med serveråtgärden save från rotlayouten) och servern renderar sedan om
 * sidan med router.refresh().
 */
export function LangProvider({ lang: initial, save, children }: { lang: Lang; save: (lang: Lang) => Promise<void>; children: ReactNode }) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initial);
  useEffect(() => setLangState(initial), [initial]);

  const setLang = useCallback(
    (next: Lang) => {
      document.documentElement.lang = next;
      setLangState(next);
      void save(next).then(() => router.refresh());
    },
    [router, save],
  );

  // Utan JSX-syntax, så att enhetstesterna (som inte transformerar JSX) kan importera filen.
  return createElement(LangContext.Provider, { value: { lang, setLang } }, children);
}

/** Ordlistan i det valda språket. I klientkomponenter: `const sv = useT();`. */
export function useT(): Dict {
  return dictionary(useContext(LangContext).lang);
}

/** Det valda språket och en funktion som byter det. */
export function useLang(): [Lang, (lang: Lang) => void] {
  const { lang, setLang } = useContext(LangContext);
  return [lang, setLang];
}
