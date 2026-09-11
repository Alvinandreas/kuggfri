import { describe, expect, it } from "vitest";
import { mergeProgress } from "@/lib/progress/migrate";
import { newProgress, reviewCard } from "@/lib/fsrs/scheduler";
import type { ProgressMap } from "@/lib/progress/types";

const T0 = new Date("2026-09-01T10:00:00Z");
const T1 = new Date("2026-09-05T10:00:00Z");
const T2 = new Date("2026-09-09T10:00:00Z");

describe("mergeProgress", () => {
  it("lokala kort som saknas på kontot flyttas", () => {
    const local: ProgressMap = { a: reviewCard("a", undefined, 4, T1) };
    const r = mergeProgress(local, {});
    expect(r.toUpsert.map((p) => p.card_id)).toEqual(["a"]);
    expect(r.merged.a).toEqual(local.a);
    expect(r.localWon).toBe(1);
    expect(r.remoteWon).toBe(0);
  });

  it("vid konflikt vinner senast last_review", () => {
    const localNewer = reviewCard("a", undefined, 2, T2);
    const remoteOlder = reviewCard("a", undefined, 5, T1);
    const r1 = mergeProgress({ a: localNewer }, { a: remoteOlder });
    expect(r1.toUpsert).toEqual([localNewer]);
    expect(r1.merged.a?.self_rating).toBe(2);

    const localOlder = reviewCard("b", undefined, 2, T0);
    const remoteNewer = reviewCard("b", undefined, 5, T1);
    const r2 = mergeProgress({ b: localOlder }, { b: remoteNewer });
    expect(r2.toUpsert).toEqual([]);
    expect(r2.merged.b?.self_rating).toBe(5);
    expect(r2.remoteWon).toBe(1);
  });

  it("lika tidsstämpel: kontots rad behålls", () => {
    const local = reviewCard("a", undefined, 1, T1);
    const remote = reviewCard("a", undefined, 5, T1);
    const r = mergeProgress({ a: local }, { a: remote });
    expect(r.toUpsert).toEqual([]);
    expect(r.merged.a?.self_rating).toBe(5);
  });

  it("en lokal rad utan last_review förlorar mot en rad med last_review", () => {
    const local = newProgress("a", T2);
    const remote = reviewCard("a", undefined, 3, T0);
    const r = mergeProgress({ a: local }, { a: remote });
    expect(r.toUpsert).toEqual([]);
    expect(r.merged.a).toEqual(remote);
  });

  it("kontots övriga kort påverkas inte", () => {
    const remote: ProgressMap = { z: reviewCard("z", undefined, 4, T0) };
    const r = mergeProgress({ a: reviewCard("a", undefined, 4, T1) }, remote);
    expect(Object.keys(r.merged).sort()).toEqual(["a", "z"]);
    expect(r.merged.z).toEqual(remote.z);
  });

  it("muterar inte indata", () => {
    const local: ProgressMap = { a: reviewCard("a", undefined, 4, T2) };
    const remote: ProgressMap = { a: reviewCard("a", undefined, 1, T0) };
    const l = JSON.stringify(local);
    const rr = JSON.stringify(remote);
    mergeProgress(local, remote);
    expect(JSON.stringify(local)).toBe(l);
    expect(JSON.stringify(remote)).toBe(rr);
  });
});
