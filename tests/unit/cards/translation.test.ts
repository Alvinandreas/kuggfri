import { describe, expect, it } from "vitest";
import { englishFace, englishFlag, flagFingerprint, swedishFingerprint, toStored, translationState } from "@/lib/cards/translation";

const card = {
  front: "Vad är viskositet?",
  back: "En vätskas motstånd mot flöde.",
  hint: null,
  options: [
    { text: "Motstånd mot flöde", correct: true },
    { text: "Densitet", correct: false },
  ],
};

describe("swedishFingerprint", () => {
  it("är stabilt och bryr sig inte om blanksteg runt texterna", () => {
    expect(swedishFingerprint(card)).toBe(swedishFingerprint({ ...card, front: `  ${card.front}\n` }));
  });

  it("ändras när fråga, svar, ledtråd, alternativ eller rätt svar ändras", () => {
    const base = swedishFingerprint(card);
    expect(swedishFingerprint({ ...card, front: "Vad är elasticitet?" })).not.toBe(base);
    expect(swedishFingerprint({ ...card, back: "Något annat." })).not.toBe(base);
    expect(swedishFingerprint({ ...card, hint: "Tänk flöde" })).not.toBe(base);
    expect(swedishFingerprint({ ...card, options: [card.options[0]!, { text: "Densitet", correct: true }] })).not.toBe(base);
  });
});

describe("översättningen i granskningen", () => {
  const translation = toStored({
    front: "What is viscosity?",
    back: "A fluid's resistance to flow.",
    options: ["Resistance to flow", "Density"],
    sv: swedishFingerprint(card),
  });

  it("säger om översättningen saknas, gäller eller gjordes av en äldre svensk text", () => {
    expect(translationState({ ...card, translation_en: null })).toBe("missing");
    expect(translationState({ ...card, translation_en: translation })).toBe("current");
    expect(translationState({ ...card, back: "Ändrad.", translation_en: translation })).toBe("stale");
  });

  it("visar engelskan med de svenska alternativens rätt och fel", () => {
    const face = englishFace({ ...card, translation_en: translation });
    expect(face?.front).toBe("What is viscosity?");
    expect(face?.options).toEqual([
      { text: "Resistance to flow", correct: true },
      { text: "Density", correct: false },
    ]);
  });

  it("behåller de svenska alternativen om antalet inte stämmer", () => {
    const face = englishFace({ ...card, translation_en: { ...translation, options: ["Only one"] } });
    expect(face?.options).toEqual(card.options);
    expect(englishFace({ ...card, translation_en: null })).toBeNull();
  });
});

describe("flaggans anteckning på engelska", () => {
  const note = "Kortet säger 723 °C, men labb-PM:et anger 727 °C. Vilket värde ska gälla?";
  const translation = toStored({
    front: "What is viscosity?",
    back: "A fluid's resistance to flow.",
    sv: swedishFingerprint(card),
    flag: "The card says 723 °C, but the lab instructions give 727 °C. Which value should apply?",
    flag_sv: flagFingerprint(note),
  });

  it("visas när den översattes från anteckningen som står på kortet", () => {
    expect(englishFlag({ flag_note: note, translation_en: translation })).toBe(translation.flag);
    expect(englishFlag({ flag_note: `${note.replace(" ", "\n")}  `, translation_en: translation })).toBe(translation.flag);
  });

  it("visas inte när anteckningen har ändrats, flaggan är borta eller översättningen saknas", () => {
    expect(englishFlag({ flag_note: "Använd samma term som i föreläsningen.", translation_en: translation })).toBeNull();
    expect(englishFlag({ flag_note: null, translation_en: translation })).toBeNull();
    expect(englishFlag({ flag_note: note, translation_en: null })).toBeNull();
    expect(englishFlag({ flag_note: note, translation_en: toStored({ front: "x", back: "y", sv: "z" }) })).toBeNull();
  });

  it("sparas bara tillsammans med sitt fingeravtryck", () => {
    expect(toStored({ front: "x", back: "y", sv: "z", flag: "Note" })).not.toHaveProperty("flag");
    expect(translation.flag_sv).toBe(flagFingerprint(note));
  });
});
