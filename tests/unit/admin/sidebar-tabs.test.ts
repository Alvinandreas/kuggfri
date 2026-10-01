import { describe, expect, it } from "vitest";
import { SIDEBAR_TAB_GROUPS, SIDEBAR_TAB_KEYS, parseHiddenTabs } from "@/lib/admin/sidebar-tabs";
import { adminTabs } from "@/lib/admin/tabs";
import { sv } from "@/lib/i18n/sv";

describe("dolda flikar i sidomenyn", () => {
  it("tolkar det lagrade värdet: bara kända nycklar, i sidomenyns ordning, utan dubbletter", () => {
    expect(parseHiddenTabs(["designsystem", "tentalaget", "okänd", "tentalaget", 3])).toEqual(["tentalaget", "designsystem"]);
    expect(parseHiddenTabs(null)).toEqual([]);
    expect(parseHiddenTabs("tentalaget")).toEqual([]);
  });

  it("varje flik finns i exakt en grupp, och adminflikarna har nycklar", () => {
    const grouped = SIDEBAR_TAB_GROUPS.flatMap((g) => g.keys);
    expect([...grouped].sort()).toEqual([...SIDEBAR_TAB_KEYS].sort());
    for (const tab of adminTabs(sv)) expect(SIDEBAR_TAB_KEYS).toContain(tab.key);
  });
});
