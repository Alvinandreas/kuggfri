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
    if (userId) {
      setStore(new SupabaseProgressStore(createSupabaseBrowserClient(), userId));
    } else {
      setStore(new LocalProgressStore(window.localStorage));
    }
  }, [userId]);

  return store;
}
