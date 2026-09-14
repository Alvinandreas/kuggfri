import { describe, expect, it } from "vitest";
import { applyTypography } from "@/lib/import/normalize";

describe("applyTypography", () => {
  it("byter => mot →", () => {
    expect(applyTypography("järnoxid + kol + energi => tackjärn")).toBe("järnoxid + kol + energi → tackjärn");
    expect(applyTypography("Ni=>bra")).toBe("Ni → bra");
  });

  it("sätter nedsänkta siffror i kemiska formler men inte i andra ord", () => {
    expect(applyTypography("Cementit, Fe3C, 6,67 % C")).toBe("Cementit, Fe₃C, 6,67 % C");
    expect(applyTypography("Ex: Al2O3, SiC, SiO2 och CO2-footprint")).toBe("Ex: Al₂O₃, SiC, SiO₂ och CO₂-footprint");
    expect(applyTypography("reagerar med O2")).toBe("reagerar med O₂");
    expect(applyTypography("ISO2 och MCO2X")).toBe("ISO2 och MCO2X");
  });

  it("konverterar unicode-matte till KaTeX", () => {
    expect(applyTypography("𝜎 = 𝐸 𝜀")).toBe("$\\sigma = E\\,\\varepsilon$");
    expect(applyTypography("𝜀 = 𝛼 ∆𝑇")).toBe("$\\varepsilon = \\alpha\\,\\Delta T$");
    expect(applyTypography("𝛼 = längdutvidgningskoefficienten")).toBe("$\\alpha$ = längdutvidgningskoefficienten");
    expect(applyTypography("enl: 𝜖𝑇 = 𝛼 (𝑇 − 𝑇0).")).toBe("enl: $\\varepsilon_T = \\alpha\\,(T - T_0)$.");
    expect(applyTypography("* (𝐾1𝑐 = 𝐸𝐺𝑐)")).toBe("* ($K_{1c} = E\\,G_c$)");
  });

  it("skriver brottseghetens beteckning och enhet med KaTeX", () => {
    expect(applyTypography("Brottseghet K1c (MPam1/2), 1 för modus")).toBe("Brottseghet $K_{1c}$ ($\\text{MPa}\\sqrt{\\text{m}}$), 1 för modus");
    expect(applyTypography("Brott när K1c> K1")).toBe("Brott när $K_{1c}$> $K_1$");
  });

  it("lämnar text utan träffar orörd", () => {
    const text = "* Ferrit är rent järn upp till 910°C, BCC.";
    expect(applyTypography(text)).toBe(text);
  });
});
