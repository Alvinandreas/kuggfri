import { expect, test } from "@playwright/test";

test.describe("cron", () => {
  test("det dagliga jobbet kräver hemligheten", async ({ request }) => {
    const noAuth = await request.get("/api/cron/daily");
    expect(noAuth.status()).toBe(401);
    const wrong = await request.get("/api/cron/daily", { headers: { Authorization: "Bearer fel" } });
    expect(wrong.status()).toBe(401);
  });
});
