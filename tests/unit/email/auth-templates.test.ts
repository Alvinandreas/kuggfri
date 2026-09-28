import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { signupNextFromMetadata } from "@/lib/auth/signup-next";

/**
 * Supabase-mallarna i supabase/templates klistras in i dashboarden för produktionen. Länkarna
 * måste gå via /auth/confirm med token_hash (fungerar på alla enheter) och med en typ som
 * route.ts godtar; annars loggas ingen in.
 */
const TEMPLATES: { file: string; type: string; next: string }[] = [
  { file: "confirmation.html", type: "signup", next: "%2F" },
  { file: "recovery.html", type: "recovery", next: "%2Fkonto%3Fbyt-losenord%3D1" },
  { file: "magic-link.html", type: "magiclink", next: "%2F" },
  { file: "email_change.html", type: "email_change", next: "%2Fkonto" },
];

function read(file: string): string {
  return readFileSync(join(process.cwd(), "supabase", "templates", file), "utf8");
}

describe("Supabase-mejlmallarna", () => {
  it.each(TEMPLATES)("$file: knappen och reservlänken går via /auth/confirm med token_hash och rätt typ", ({ file, type, next }) => {
    const html = read(file);
    const link = `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${next}`;
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.filter((h) => h === link)).toHaveLength(2);
    // Supabase standardlänk (ConfirmationURL) fungerar bara i samma webbläsare; den ska inte användas.
    expect(html).not.toContain("ConfirmationURL");
  });

  it.each(TEMPLATES)("$file: mejlsäker HTML på svenska, utan användarstyrd text", ({ file }) => {
    const html = read(file);
    expect(html).toContain('<html lang="sv"');
    expect(html).toContain('role="presentation"');
    expect(html).toContain("max-width:560px");
    // Namnet sätts av den som registrerar, inte av adressens ägare, och ska inte in i mejlen.
    expect(html).not.toContain(".Data.");
    // Bilder bara från den publika sajten, och bara filer som finns i public/.
    for (const [, src] of html.matchAll(/src="([^"]+)"/g)) {
      expect(src).toMatch(/^https:\/\/kuggfri\.com\//);
      expect(() => readFileSync(join(process.cwd(), "public", src!.replace("https://kuggfri.com/", "")))).not.toThrow();
    }
    expect(html).not.toContain("—");
    expect(html).toContain("Om det inte var du kan du ignorera mejlet");
  });

  it("välkomstmejlet har den nyttiga informationen", () => {
    const html = read("confirmation.html");
    for (const text of ["20 nya", "tentadatum", "hemskärmen", "{{ .SiteURL }}/hjalp"]) expect(html).toContain(text);
  });
});

describe("signupNextFromMetadata", () => {
  it("läser en intern sökväg", () => {
    expect(signupNextFromMetadata({ signup_next: "/d/materialteknik" })).toBe("/d/materialteknik");
  });
  it.each([undefined, null, {}, { signup_next: "/" }, { signup_next: "https://ond.example" }, { signup_next: "//ond.example" }, { signup_next: 5 }])(
    "ger null för %j",
    (meta) => {
      expect(signupNextFromMetadata(meta as Record<string, unknown> | null | undefined)).toBeNull();
    },
  );
});
