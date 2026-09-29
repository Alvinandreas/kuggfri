import { describe, expect, it } from "vitest";
import { parseCardFile, serializeCardFile } from "@/lib/content/markdown";
import { cardContentHash, slugifyKey, uniqueKey } from "@/lib/content/model";

const FILE = `# Kristallstruktur

## Vad är en enhetscell?
key: enhetscell

Den minsta upprepade byggstenen i ett kristallgitter.

## Vad skiljer BCC från FCC?
key: bcc-fcc
ledtråd: Tänk på antalet atomer per enhetscell.

- BCC: 2 atomer per cell
- FCC: 4 atomer per cell

Packningsgrad $0{,}68$ respektive $0{,}74$.

## Ett kort som vilar
key: vilande
aktiv: nej

Syns inte för studenterna, men progressen finns kvar.
`;

describe("kortfiler", () => {
  it("läser titel, framsidor, nycklar, ledtrådar och flerstyckiga baksidor", () => {
    const { file, issues } = parseCardFile(FILE);
    expect(issues).toEqual([]);
    expect(file.title).toBe("Kristallstruktur");
    expect(file.cards).toHaveLength(3);

    const [first, second, third] = file.cards;
    expect(first?.key).toBe("enhetscell");
    expect(first?.front).toBe("Vad är en enhetscell?");
    expect(first?.back).toBe("Den minsta upprepade byggstenen i ett kristallgitter.");
    expect(first?.hint).toBeNull();
    expect(first?.active).toBe(true);

    expect(second?.hint).toBe("Tänk på antalet atomer per enhetscell.");
    expect(second?.back).toContain("- FCC: 4 atomer per cell");
    expect(second?.back).toContain("$0{,}68$");

    expect(third?.active).toBe(false);
  });

  it("rundtur: text → modell → text ger samma fil", () => {
    const { file } = parseCardFile(FILE);
    expect(serializeCardFile(file)).toBe(FILE);
  });

  it("## inuti en kodstaket startar inte ett nytt kort", () => {
    const text = `# Kod

## Hur ser en rubrik ut i markdown?
key: markdown-rubrik

\`\`\`markdown
## Detta är en rubrik
\`\`\`

Två brädgårdar följt av mellanslag.
`;
    const { file, issues } = parseCardFile(text);
    expect(issues).toEqual([]);
    expect(file.cards).toHaveLength(1);
    expect(file.cards[0]?.back).toContain("## Detta är en rubrik");
    expect(serializeCardFile(file)).toBe(text);
  });

  it("rapporterar saknad rubrik, tom baksida och ogiltig nyckel med radnummer", () => {
    const { issues } = parseCardFile("## Utan rubrik\nkey: FEL NYCKEL\n\n");
    expect(issues.map((i) => i.message)).toEqual([
      expect.stringContaining("saknar baksida"),
      expect.stringContaining("Ogiltig nyckel"),
      expect.stringContaining("saknar områdesrubrik"),
    ]);
  });

  it("engelska nyckelord fungerar också", () => {
    const { file } = parseCardFile("# T\n\n## F\nkey: f\nhint: H\nactive: no\n\nB\n");
    expect(file.cards[0]).toMatchObject({ key: "f", hint: "H", active: false });
  });
});

describe("nycklar", () => {
  it("härleds ur texten, translittererar svenska tecken och kortas vid ordgräns", () => {
    expect(slugifyKey("Vad är en enhetscell?")).toBe("vad-ar-en-enhetscell");
    expect(slugifyKey("Stål, värmebehandling och bearbetning")).toBe("stal-varmebehandling-och-bearbetning");
    // Längre än 40 tecken kortas vid närmaste ordgräns.
    expect(slugifyKey("Redogör för vad gjutning innebär för materialet och ge exempel")).toBe("redogor-for-vad-gjutning-innebar-for");
    expect(slugifyKey("Vad är $\\sigma$?")).toBe("vad-ar-sigma");
    expect(slugifyKey("???")).toBe("kort");
    expect(slugifyKey("A".repeat(80)).length).toBeLessThanOrEqual(40);
  });

  it("görs unika med suffix", () => {
    const taken = new Set<string>();
    expect(uniqueKey("kort", taken)).toBe("kort");
    expect(uniqueKey("kort", taken)).toBe("kort-2");
    expect(uniqueKey("kort", taken)).toBe("kort-3");
  });
});

describe("innehållshashen", () => {
  const base = { front: "F", back: "B", hint: null, active: true, kind: "sjalvskattning" as const, options: null, review: null, source: null, original: false, flag: null };

  it("ändras när något fält i kortet ändras", () => {
    const h = cardContentHash(base, "kat");
    expect(cardContentHash({ ...base, front: "F2" }, "kat")).not.toBe(h);
    expect(cardContentHash({ ...base, back: "B2" }, "kat")).not.toBe(h);
    expect(cardContentHash({ ...base, hint: "L" }, "kat")).not.toBe(h);
    expect(cardContentHash({ ...base, active: false }, "kat")).not.toBe(h);
    expect(cardContentHash(base, "annan")).not.toBe(h);
  });

  it("ändras även för fält som läggs till senare", () => {
    // Skyddet mot tyst dataförlust: hashen bygger på kortets alla fält, inte en handplockad
    // lista. Ett nytt fält (t.ex. korttyp eller svarsalternativ) måste påverka hashen,
    // annars skulle pipelinen se ett ändrat kort som oförändrat och aldrig skriva det.
    const utökad = { ...base, typ: "flerval", alternativ: ["a", "b"] } as unknown as typeof base;
    expect(cardContentHash(utökad, "kat")).not.toBe(cardContentHash(base, "kat"));
  });

  it("påverkas inte av nyckeln eller av fältens ordning", () => {
    const medNyckel = { ...base, key: "k1" } as unknown as typeof base;
    expect(cardContentHash(medNyckel, "kat")).toBe(cardContentHash(base, "kat"));
    const omkastad = { flag: null, original: false, source: null, review: null, options: null, kind: "sjalvskattning" as const, active: true, hint: null, back: "B", front: "F" };
    expect(cardContentHash(omkastad, "kat")).toBe(cardContentHash(base, "kat"));
  });

  it("ger samma hash som före uppgiftstyperna när de nya fälten har standardvärden", () => {
    // Alla kort som fanns 28 sep ska se oförändrade ut vid nästa synk.
    const gammalt = { front: "F", back: "B", hint: null, active: true } as unknown as typeof base;
    expect(cardContentHash(base, "kat")).toBe(cardContentHash(gammalt, "kat"));
  });

  it("ändras när typ, alternativ, status eller källa avviker från standard", () => {
    const h = cardContentHash(base, "kat");
    expect(cardContentHash({ ...base, kind: "begrepp" }, "kat")).not.toBe(h);
    const alternativ = { ...base, kind: "alternativ" as const, options: [{ text: "a", correct: true }, { text: "b", correct: false }] };
    expect(cardContentHash(alternativ, "kat")).not.toBe(cardContentHash({ ...alternativ, options: [{ text: "a", correct: false }, { text: "b", correct: true }] }, "kat"));
    expect(cardContentHash({ ...base, review: "utkast", active: false }, "kat")).not.toBe(cardContentHash({ ...base, active: false }, "kat"));
    expect(cardContentHash({ ...base, source: "Canvas" }, "kat")).not.toBe(h);
    expect(cardContentHash({ ...base, original: true }, "kat")).not.toBe(h);
    expect(cardContentHash({ ...base, flag: "Svaret stämmer inte med frågan." }, "kat")).not.toBe(h);
  });

  it("ger samma hash som före flaggorna när flaggan saknas eller är null", () => {
    // Alla kort som fanns 30 sep ska se oförändrade ut vid nästa synk.
    const { flag: _flag, ...utanFlagga } = base;
    void _flag;
    expect(cardContentHash(utanFlagga as typeof base, "kat")).toBe(cardContentHash(base, "kat"));
    expect(cardContentHash({ ...base, flag: undefined } as unknown as typeof base, "kat")).toBe(cardContentHash(base, "kat"));
  });
});

describe("flaggor i kortfilerna", () => {
  const FLAGGAD = `# Metaller

## Vad är duktilitet?
key: duktilitet
status: utkast
källa: Canvas, Quiz 2, fråga 3
flagga: Svaret blandar ihop duktilitet och seghet.

Förmågan att deformeras plastiskt före brott.
`;

  it("läser flagga: och skriver tillbaka den (rundtur)", () => {
    const { file, issues } = parseCardFile(FLAGGAD);
    expect(issues).toEqual([]);
    expect(file.cards[0]).toMatchObject({ key: "duktilitet", review: "utkast", flag: "Svaret blandar ihop duktilitet och seghet." });
    expect(serializeCardFile(file)).toBe(FLAGGAD);
  });

  it("ett kort utan flagga får null, och flag: fungerar också", () => {
    expect(parseCardFile(FILE).file.cards.every((c) => c.flag === null)).toBe(true);
    expect(parseCardFile("# T\n\n## F\nkey: f\nflag: Kolla enheten\n\nB\n").file.cards[0]?.flag).toBe("Kolla enheten");
  });

  it("en flagga med radbrytningar (skriven i admin) blir en rad i filen", () => {
    const { file } = parseCardFile(FLAGGAD);
    const card = { ...file.cards[0]!, flag: "Rad ett.\nRad två." };
    const text = serializeCardFile({ ...file, cards: [card] });
    expect(text).toContain("flagga: Rad ett. Rad två.\n");
    expect(parseCardFile(text).file.cards[0]?.flag).toBe("Rad ett. Rad två.");
  });
});
