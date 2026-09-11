import { describe, expect, it } from "vitest";
import { diffImport, type ExistingCard, type ExistingCategory } from "@/lib/import/diff";
import type { ImportCard } from "@/lib/import/parse-import";

const categories: ExistingCategory[] = [{ id: "c1", title: "Stål" }];
const existing: ExistingCard[] = [
  { id: "k1", front: "Vad är stål?", back: "Järn + kol", hint: null, category_id: "c1", sort_order: 0 },
  { id: "k2", front: "Vad är ferrit?", back: "Rent järn", hint: "BCC", category_id: null, sort_order: 1 },
];

const card = (partial: Partial<ImportCard> & Pick<ImportCard, "front" | "back">): ImportCard => ({
  hint: null,
  category: null,
  sort_order: null,
  row: 1,
  ...partial,
});

describe("diffImport", () => {
  it("klassificerar nya, uppdaterade och oförändrade kort", () => {
    const d = diffImport(
      [
        card({ front: "Vad är stål?", back: "Järn + kol", category: "Stål" }),
        card({ front: "Vad är ferrit?", back: "Rent järn, BCC" }),
        card({ front: "Ny fråga", back: "Nytt svar" }),
      ],
      existing,
      categories,
    );
    expect(d.unchanged.map((c) => c.front)).toEqual(["Vad är stål?"]);
    expect(d.update.map((u) => u.id)).toEqual(["k2"]);
    expect(d.update[0]?.changedFields).toEqual(["back"]);
    expect(d.create.map((c) => c.front)).toEqual(["Ny fråga"]);
    expect(d.errors).toEqual([]);
  });

  it("matchar framsidan okänsligt för skiftläge och blanksteg", () => {
    const d = diffImport([card({ front: "  vad är   STÅL? ", back: "Järn + kol", category: "stål" })], existing, categories);
    expect(d.unchanged).toHaveLength(1);
    expect(d.newCategories).toEqual([]);
  });

  it("behåller befintlig ledtråd, kategori och ordning när importen saknar dem", () => {
    const d = diffImport([card({ front: "Vad är ferrit?", back: "Rent järn" })], existing, categories);
    expect(d.unchanged).toHaveLength(1);
  });

  it("rensar ledtråden bara om importen uttryckligen sätter den", () => {
    const d = diffImport([card({ front: "Vad är ferrit?", back: "Rent järn", hint: "FCC" })], existing, categories);
    expect(d.update[0]?.changedFields).toEqual(["hint"]);
    expect(d.update[0]?.after.hint).toBe("FCC");
  });

  it("listar nya kategorier", () => {
    const d = diffImport([card({ front: "Ny", back: "x", category: "Keramer" }), card({ front: "Ny 2", back: "y", category: "keramer " })], existing, categories);
    expect(d.newCategories).toEqual(["Keramer"]);
    expect(d.create).toHaveLength(2);
  });

  it("rapporterar dubbletter i importen och behåller den första", () => {
    const d = diffImport([card({ front: "Dubbel", back: "1", row: 2 }), card({ front: "dubbel", back: "2", row: 3 })], existing, categories);
    expect(d.create).toHaveLength(1);
    expect(d.create[0]?.back).toBe("1");
    expect(d.errors[0]?.row).toBe(3);
  });

  it("upptäcker ändrad sort_order och kategori", () => {
    const d = diffImport([card({ front: "Vad är stål?", back: "Järn + kol", category: "Legeringar", sort_order: 5 })], existing, categories);
    expect(d.update[0]?.changedFields).toEqual(["category", "sort_order"]);
    expect(d.update[0]?.after.category).toBe("Legeringar");
    expect(d.newCategories).toEqual(["Legeringar"]);
  });
});
