"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { dictionary } from "./index";
import { LANG_COOKIE, type Dict, type Lang } from "./types";

type LangState = { lang: Lang; setLang: (lang: Lang) => void };

const LangContext = createContext<LangState>({ lang: "sv", setLang: () => {} });

/**
 * Språket i klienten. Rotlayouten läser cookien och skickar in språket, så att servern och
 * klienten renderar samma text. Byte: cookien skrivs (ett år, bara den här webbläsaren), klienten
 * byter direkt och servern renderar om sidan med router.refresh().
 */
export function LangProvider({ lang: initial, children }: { lang: Lang; children: ReactNode }) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initial);
  useEffect(() => setLangState(initial), [initial]);

  const setLang = useCallback(
    (next: Lang) => {
      document.cookie = next === "en" ? `${LANG_COOKIE}=en; path=/; max-age=31536000; samesite=lax` : `${LANG_COOKIE}=; path=/; max-age=0; samesite=lax`;
      document.documentElement.lang = next;
      setLangState(next);
      router.refresh();
    },
    [router],
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
