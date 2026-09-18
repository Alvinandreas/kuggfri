"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { LocalProgressStore, SupabaseProgressStore, type ProgressStore } from "./store";

/**
 * Rätt progresslager för aktuell användare. Returnerar null tills komponenten
 * är monterad i webbläsaren (localStorage finns inte vid serverrendering).
 */
export function useProgressStore(userId: string | null): ProgressStore | null {
  const [store, setStore] = useState<ProgressStore | null>(null);

  useEffect(() => {
    if (!userId) {
      setStore(new LocalProgressStore(window.localStorage));
      return;
    }
    const account = new SupabaseProgressStore(createSupabaseBrowserClient(), userId, window.localStorage);
    setStore(account);
    // Skrivningar som köats under tappad anslutning skickas när sidan laddas och när nätet kommer tillbaka.
    void account.flush();
    const onOnline = () => void account.flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [userId]);

  return store;
}
