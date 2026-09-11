import { describe, expect, it } from "vitest";
import { normalizeBrainscapeMarkdown } from "@/lib/import/normalize";

describe("normalizeBrainscapeMarkdown", () => {
  it("gör minustecken-rader till nästlade punkter under en stjärnpunkt", () => {
    const input = "* Kovalent bindning:\n− Stark\n− Riktningsberoende\n* Metallbindning:\n− Elektronmoln";
    expect(normalizeBrainscapeMarkdown(input)).toBe(
      "* Kovalent bindning:\n  - Stark\n  - Riktningsberoende\n* Metallbindning:\n  - Elektronmoln",
    );
  });

  it("gör minustecken-rader utan föregående punkt till en vanlig lista", () => {
    expect(normalizeBrainscapeMarkdown("Två typer:\n- Diffusionskrypning\n- Dislokationskrypning")).toBe(
      "Två typer:\n- Diffusionskrypning\n- Dislokationskrypning",
    );
  });

  it("separerar en rubrikrad med kolon från föregående lista", () => {
    const input = "* Mängd CO2 som bildas\nFör metaller:\n- CO2 bildas vid produktion";
    expect(normalizeBrainscapeMarkdown(input)).toBe("* Mängd CO2 som bildas\n\nFör metaller:\n- CO2 bildas vid produktion");
  });

  it("låter vanliga radbrytningar mitt i meningar vara (markdown slår ihop dem)", () => {
    const input = "* Elektriskt och termiskt\nledande";
    expect(normalizeBrainscapeMarkdown(input)).toBe("* Elektriskt och termiskt\nledande");
  });

  it("tar bort CRLF, avslutande blanksteg och överflödiga tomrader", () => {
    expect(normalizeBrainscapeMarkdown("a  \r\n\r\n\r\n\r\nb ")).toBe("a\n\nb");
  });
});
