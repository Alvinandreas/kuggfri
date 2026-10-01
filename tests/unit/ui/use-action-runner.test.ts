// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sv } from "@/lib/i18n/sv";
import { useActionRunner } from "@/lib/ui/use-action-runner";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => refresh.mockClear());

describe("useActionRunner", () => {
  it("handle: vid lyckat nollställs felet, onOk körs före omladdningen", async () => {
    const calls: string[] = [];
    refresh.mockImplementation(() => calls.push("refresh"));
    const { result } = renderHook(() => useActionRunner());
    await act(async () => result.current.handle(Promise.resolve({ ok: true }), () => calls.push("onOk")));
    expect(result.current.error).toBeNull();
    expect(calls).toEqual(["onOk", "refresh"]);
  });

  it("handle: vid fel visas felet och sidan läses inte om", async () => {
    const onOk = vi.fn();
    const { result } = renderHook(() => useActionRunner());
    await act(async () => result.current.handle(Promise.resolve({ ok: false, error: "Nej" }), onOk));
    expect(result.current.error).toBe("Nej");
    await act(async () => result.current.handle(Promise.resolve({ ok: false })));
    expect(result.current.error).toBe(sv.errors.generic);
    expect(onOk).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("run: läser om sidan även vid fel och nollställer felet vid nästa körning", async () => {
    const { result } = renderHook(() => useActionRunner());
    await act(async () => result.current.run(() => Promise.resolve({ ok: false, error: "Nej" })));
    expect(result.current.error).toBe("Nej");
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => result.current.run(() => Promise.resolve({ ok: true })));
    expect(result.current.error).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
