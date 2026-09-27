"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * En inställning i webbläsaren (localStorage) som flera komponenter läser samtidigt,
 * t.ex. ljudet som slås av på kortet och i menyn under det. Ändras den på ett ställe
 * uppdateras alla direkt, även i andra flikar.
 */
export function createBrowserSetting<T>(key: string, fallback: T, parse: (raw: string) => T, serialize: (value: T) => string | null) {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } | null = null;

  function read(): T {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (cache && cache.raw === raw) return cache.value;
    let value = fallback;
    if (raw !== null) {
      try {
        value = parse(raw);
      } catch {
        value = fallback;
      }
    }
    cache = { raw, value };
    return value;
  }

  function write(value: T) {
    const raw = serialize(value);
    try {
      if (raw === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, raw);
    } catch {
      // Blockerad lagring: värdet gäller tills sidan laddas om.
    }
    cache = { raw, value };
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useSetting(): [T, (value: T) => void] {
    const value = useSyncExternalStore(subscribe, read, () => fallback);
    const set = useCallback((v: T) => write(v), []);
    return [value, set];
  }

  return { read, write, useSetting };
}
