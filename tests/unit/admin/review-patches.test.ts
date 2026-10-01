import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NO_FLAG, approvedPatch, rejectedPatch, reviewTab, type ReviewCard } from "@/lib/admin/review";

const USER = "11111111-1111-4111-8111-111111111111";
const AT = "2026-10-01T08:30:00.000Z";

const card: ReviewCard = {
  id: "c1",
  category_id: null,
  front: "Fråga",
  back: "Svar",
  hint: null,
  kind: "sjalvskattning",
  options: null,
  is_active: false,
  review_status: "utkast",
  review_note: "gammal",
  reviewed_by: null,
  reviewed_at: null,
  source: null,
  sort_order: 0,
  created_at: AT,
  flag_note: "Fel årtal",
  flagged_at: AT,
  flagged_by: USER,
};

describe("NO_FLAG", () => {
  it("nollar flaggans tre fält", () => {
    expect(NO_FLAG).toEqual({ flag_note: null, flagged_at: null, flagged_by: null });
  });
});

describe("approvedPatch", () => {
  it("utan status, aktivt, granskat av användaren vid tiden, utan flagga", () => {
    expect(approvedPatch(USER, AT)).toEqual({
      review_status: null,
      is_active: true,
      reviewed_by: USER,
      reviewed_at: AT,
      flag_note: null,
      flagged_at: null,
      flagged_by: null,
    });
  });

  it("rör inte granskningskommentaren", () => {
    expect(approvedPatch(USER, AT)).not.toHaveProperty("review_note");
  });

  it("ett godkänt kort hamnar under Granskade", () => {
    expect(reviewTab({ ...card, ...approvedPatch(USER, AT) })).toBe("granskade");
  });
});

describe("rejectedPatch", () => {
  it("avvisat med kommentaren, inaktivt, granskat av användaren vid tiden, utan flagga", () => {
    expect(rejectedPatch(USER, AT, "Dubblett")).toEqual({
      review_status: "avvisad",
      review_note: "Dubblett",
      is_active: false,
      reviewed_by: USER,
      reviewed_at: AT,
      flag_note: null,
      flagged_at: null,
      flagged_by: null,
    });
  });

  it("tom kommentar blir null", () => {
    expect(rejectedPatch(USER, AT, "").review_note).toBeNull();
  });

  it("ett avvisat kort hör inte till någon flik", () => {
    expect(reviewTab({ ...card, ...rejectedPatch(USER, AT, "") })).toBeNull();
  });
});

describe("serveråtgärderna använder samma fält", () => {
  const source = readFileSync(join(process.cwd(), "lib/admin/review-actions.ts"), "utf8");

  it("inga handskrivna godkänt- eller avvisat-patchar och ingen egen NO_FLAG", () => {
    expect(source).not.toMatch(/review_status:\s*"avvisad"/);
    expect(source).not.toMatch(/review_status:\s*null,\s*is_active:\s*true/);
    expect(source).not.toMatch(/const NO_FLAG/);
    expect(source).toMatch(/approvedPatch\(ctx\.userId, reviewedAt\)/);
    expect(source).toMatch(/rejectedPatch\(ctx\.userId, reviewedAt, text\)/);
  });
});
