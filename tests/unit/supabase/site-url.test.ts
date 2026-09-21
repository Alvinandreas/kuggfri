import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "@/lib/supabase/env";

/**
 * Regressionsskydd för en tyst felväg: utan NEXT_PUBLIC_SITE_URL pekade varje länk i
 * varje utskickat mejl på localhost, och felet syntes bara för den som klickade.
 */
const original = { ...process.env };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
});

afterEach(() => {
  process.env = { ...original };
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getSiteUrl", () => {
  it("använder den uttryckliga adressen och kapar avslutande snedstreck", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://kuggfri.com/";
    expect(getSiteUrl()).toBe("https://kuggfri.com");
  });

  it("faller tillbaka på Vercels adress i stället för localhost", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "kuggfri.vercel.app";
    expect(getSiteUrl()).toBe("https://kuggfri.vercel.app");
    expect(console.error).toHaveBeenCalled();
  });

  it("den uttryckliga adressen vinner över Vercels", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://kuggfri.com";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "kuggfri.vercel.app";
    expect(getSiteUrl()).toBe("https://kuggfri.com");
  });

  it("utan någon adress alls blir det localhost, men aldrig tyst i produktion", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getSiteUrl()).toBe("http://localhost:3000");
    expect(console.error).toHaveBeenCalled();
  });
});
