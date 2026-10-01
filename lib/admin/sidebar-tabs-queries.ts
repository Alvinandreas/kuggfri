import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HIDDEN_TABS_SETTING, parseHiddenTabs, type SidebarTabKey } from "./sidebar-tabs";

/** Flikarna som är dolda i sidomenyn (lib/admin/sidebar-tabs.ts). Ett fel ger inga dolda flikar. */
export const getHiddenTabs = cache(async (): Promise<SidebarTabKey[]> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("app_settings").select("value").eq("key", HIDDEN_TABS_SETTING).maybeSingle();
    return parseHiddenTabs(data?.value);
  } catch {
    return [];
  }
});
