import { expect, test } from "@playwright/test";

test.describe("cron", () => {
  test("det dagliga jobbet kräver hemligheten", async ({ request }) => {
    const noAuth = await request.get("/api/cron/daily");
    expect(noAuth.status()).toBe(401);
    const wrong = await request.get("/api/cron/daily", { headers: { Authorization: "Bearer fel" } });
    expect(wrong.status()).toBe(401);
  });
});

test.describe("cacherensning", () => {
  test("kräver hemligheten", async ({ request }) => {
    expect((await request.post("/api/revalidate")).status()).toBe(401);
    expect((await request.post("/api/revalidate", { headers: { Authorization: "Bearer fel" } })).status()).toBe(401);
  });
});
