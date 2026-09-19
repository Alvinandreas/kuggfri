import { describe, expect, it } from "vitest";
import { parseCardFile, serializeCardFile } from "@/lib/content/markdown";
import { slugifyKey, uniqueKey } from "@/lib/content/model";

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
      expect.stringContaining("saknar kategorirubrik"),
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
