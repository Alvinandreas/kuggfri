/**
 * Kurskonfiguration: det som skiljer en kurs från en annan men inte är innehåll (kort,
 * områden och kursuppgifter står i content/<kurs>/kurs.json och synkas till databasen).
 * Ren modul utan beroenden på server eller filsystem, så att både appen, admin och
 * verktygen kan läsa den. En ny kurs får en egen fil här och en rad i ALL_COURSES;
 * se docs/NY-KURS.md.
 */
import type { SourceKind } from "@/lib/cards/sources";
import { materialteknik } from "./materialteknik";

export type CourseContact = {
  name: string;
  /** Visas under namnet på Om och Hjälp, t.ex. "Examinator för X: frågor om kursens innehåll". */
  role: string;
  email: string;
};

export type CourseConfig = {
  /** Kursens nyckel = mappen i content/ = sluggen i /d/<slug>. */
  slug: string;
  /** Kontakten för frågor om kursens innehåll. Null = ingen egen kontakt på Om och Hjälp. */
  examiner: CourseContact | null;
  /** När tentan börjar på tentadagen (lokal tid). Nedräkningen på hemsidan siktar dit. */
  examStart: { hour: number; minute: number };
  /**
   * Källtips: kursens egna dokumentnamn (bokens filnamn, föreläsningsserier, förkortningar)
   * per källtyp. Läggs till de generiska reglerna i lib/cards/sources.ts.
   */
  sourceHints: Partial<Record<SourceKind, RegExp[]>>;
};

/** Det en kursfil måste ange; resten tas från standardvärdena. */
export type CourseConfigInput = Pick<CourseConfig, "slug"> & Partial<Omit<CourseConfig, "slug">>;

/** Standardvärden för en kurs utan egen konfiguration. Tentor på Chalmers börjar oftast 08.30. */
export const COURSE_DEFAULTS: Omit<CourseConfig, "slug"> = {
  examiner: null,
  examStart: { hour: 8, minute: 30 },
  sourceHints: {},
};

function withDefaults(input: CourseConfigInput): CourseConfig {
  return { ...COURSE_DEFAULTS, ...input };
}

/** Alla kurser med egen konfiguration, i den ordning de visas (t.ex. examinatorerna på Om). */
export const ALL_COURSES: readonly CourseConfig[] = [materialteknik].map(withDefaults);

/** Kursens konfiguration; en okänd kurs får standardvärdena. */
export function courseConfig(slug: string): CourseConfig {
  return ALL_COURSES.find((c) => c.slug === slug) ?? withDefaults({ slug });
}
