"use server";

import { revalidatePath } from "next/cache";
import { adminAction } from "@/lib/actions/guard";
import { fail, type ActionResult } from "@/lib/actions/result";
import { HIDDEN_TABS_SETTING, parseHiddenTabs, type SidebarTabKey } from "./sidebar-tabs";

/**
 * Sparar vilka flikar som är dolda i sidomenyn. Bara global admin (adminAction, och RLS på
 * app_settings nekar dessutom). Okända nycklar tas bort. Alla sidor renderas om, eftersom
 * sidomenyn finns på alla.
 */
export async function saveHiddenTabsAction(keys: string[]): Promise<ActionResult<{ hidden: SidebarTabKey[] }>> {
  return adminAction(async ({ supabase, ctx }) => {
    const hidden = parseHiddenTabs(keys);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: HIDDEN_TABS_SETTING, value: hidden, updated_at: new Date().toISOString(), updated_by: ctx.userId }, { onConflict: "key" });
    if (error) return fail(error);
    revalidatePath("/", "layout");
    return { ok: true, data: { hidden } };
  });
}
