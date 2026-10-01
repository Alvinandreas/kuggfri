import { describe, expect, it } from "vitest";
import { sourceKindOf } from "@/lib/cards/sources";
import { CONTACTS, EXAMINERS, SITE_HOST } from "@/lib/contact";
import { listCourseKeys } from "@/lib/content/store";
import { ALL_COURSES, COURSE_DEFAULTS, courseConfig } from "@/lib/courses";

describe("kurskonfigurationen", () => {
  it("har en konfiguration per kurs i content/ och unika sluggar", () => {
    const slugs = ALL_COURSES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const key of listCourseKeys(process.cwd())) expect(slugs, key).toContain(key);
  });

  it("ger standardvärdena för en okänd kurs", () => {
    expect(courseConfig("finns-inte")).toEqual({ slug: "finns-inte", ...COURSE_DEFAULTS });
    expect(COURSE_DEFAULTS.examStart).toEqual({ hour: 8, minute: 30 });
  });

  it("Materialteknik: examinator och tentastart som tidigare", () => {
    const c = courseConfig("materialteknik");
    expect(c.examiner).toEqual({
      name: "Johan Ahlström",
      role: "Examinator för Materialteknik: frågor om kursens innehåll",
      email: "johan.ahlstrom@chalmers.se",
    });
    expect(c.examStart).toEqual({ hour: 8, minute: 30 });
  });

  it("kontaktkorten: operatören och sedan varje examinator en gång", () => {
    expect(CONTACTS.operator.email).toBe("alvinan@chalmers.se");
    expect(EXAMINERS.map((e) => e.email)).toEqual(["johan.ahlstrom@chalmers.se"]);
    expect(SITE_HOST).toBe("kuggfri.com");
  });

  it("kursens källtips styr klassificeringen; utan dem faller dokumentet till övrigt", () => {
    expect(sourceKindOf("05142_10 (Osswald kap. 10)")).toBe("bok");
    expect(sourceKindOf("GLU 02 Fasdiagram")).toBe("forelasning");
    // Generiska regler går före källtipsen, i samma ordning som förut.
    expect(sourceKindOf("Quiz Polymeric materials Fö19-21")).toBe("quiz");
    expect(sourceKindOf("Ashby Läsanvisning")).toBe("kursdokument");
    expect(sourceKindOf("Glukos")).toBe("ovrigt");
  });
});
