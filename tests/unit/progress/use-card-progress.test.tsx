// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCardProgress } from "@/lib/progress/use-card-progress";
import type { ProgressStore } from "@/lib/progress/store";
import type { ProgressMap, ReviewEntry } from "@/lib/progress/types";

function fakeStore(load: () => Promise<ProgressMap>, loadReviews: () => Promise<ReviewEntry[]>) {
  return { load: vi.fn(load), loadReviews: vi.fn(loadReviews) } as unknown as ProgressStore & {
    load: ReturnType<typeof vi.fn>;
    loadReviews: ReturnType<typeof vi.fn>;
  };
}

const review = { card_id: "a", reviewed_at: "2026-09-30T10:00:00.000Z" } as ReviewEntry;

describe("useCardProgress", () => {
  it("är null och tom tills lagret finns", () => {
    const { result } = renderHook(() => useCardProgress(null, ["a"]));
    expect(result.current.progress).toBeNull();
    expect(result.current.reviews).toEqual([]);
  });

  it("laddar progress och historik för korten", async () => {
    const progress = { a: {} } as unknown as ProgressMap;
    const store = fakeStore(
      () => Promise.resolve(progress),
      () => Promise.resolve([review]),
    );
    const ids = ["a", "b"];
    const { result } = renderHook(() => useCardProgress(store, ids));
    expect(result.current.progress).toBeNull();
    await waitFor(() => expect(result.current.progress).toBe(progress));
    expect(result.current.reviews).toEqual([review]);
    expect(store.load).toHaveBeenCalledWith(ids);
    expect(store.loadReviews).toHaveBeenCalledWith(ids);
  });

  it("ger tom karta och tom historik när laddningen misslyckas", async () => {
    const store = fakeStore(
      () => Promise.reject(new Error("nät")),
      () => Promise.resolve([review]),
    );
    const { result } = renderHook(() => useCardProgress(store, ["a"]));
    await waitFor(() => expect(result.current.progress).toEqual({}));
    expect(result.current.reviews).toEqual([]);
  });

  it("kastar svar som kommer efter avmontering", async () => {
    let resolve!: (p: ProgressMap) => void;
    const store = fakeStore(
      () => new Promise<ProgressMap>((r) => (resolve = r)),
      () => Promise.resolve([]),
    );
    const { result, unmount } = renderHook(() => useCardProgress(store, ["a"]));
    unmount();
    resolve({});
    await Promise.resolve();
    expect(result.current.progress).toBeNull();
  });
});
