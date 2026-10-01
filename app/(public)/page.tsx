import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarClock, ChartNoAxesColumn, GraduationCap } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { safeNext } from "@/lib/auth/safe-next";
import { first } from "@/lib/http/search-params";
import { getCurrentUser } from "@/lib/supabase/server";
import { AuthPanel } from "@/components/auth/AuthForms";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: { absolute: `${sv.app.name} – ${sv.landing.title}` } };
}

const ICONS = [CalendarClock, GraduationCap, ChartNoAxesColumn];

/**
 * Landningssidan: vad Kuggfri är, i tre rader, och formuläret. Inloggade skickas vidare
 * till hemsidan (eller dit länken de följde pekade). ?next= kommer från inloggningsgrinden
 * i middleware, ?flik=logga-in öppnar inloggningsfliken direkt. Om, Hjälp och
 * integritetspolicyn länkas från sidfoten i PublicLayout (krav för inloggning med Google).
 *
 * På stor skärm står formuläret i höger spalt över alla fyra rader, och vänsterspaltens två
 * block (rubriken med ingressen, punkterna) står i raderna 2 och 3 mellan två lika höga
 * fyllnadsrader, så att de tillsammans hamnar mitt för formuläret. På mobil kommer
 * formuläret mellan ingressen och punkterna.
 */
export default async function LandingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeNext(query.next, routes.home());
  const user = await getCurrentUser();
  if (user) redirect(next);
  const flik = first(query.flik);
  const sv = await getT();

  return (
    <div className="grid items-center gap-10 py-4 lg:grow lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:grid-rows-[1fr_auto_auto_1fr] lg:gap-x-16 lg:gap-y-0 lg:py-0">
      <div className="anim-fade-up lg:col-start-1 lg:row-start-2">
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">{sv.landing.title}</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">{sv.landing.lead}</p>
      </div>

      <div className="lg:col-start-2 lg:row-span-4 lg:row-start-1">
        <AuthPanel next={next} initialTab={flik === "logga-in" ? "logga-in" : "registrera"} hint={next !== routes.home() ? sv.landing.nextHint : null} />
      </div>

      <ul className="grid gap-5 lg:col-start-1 lg:row-start-3 lg:mt-16">
        {sv.landing.points.map((p, i) => {
          const Icon = ICONS[i] ?? CalendarClock;
          return (
            <li key={p.title} className="anim-fade-up flex gap-4" style={{ ["--i" as string]: i + 2 }}>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-2 text-accent">
                <Icon size={21} strokeWidth={2} aria-hidden />
              </span>
              <div>
                <p className="font-bold">{p.title}</p>
                <p className="text-muted">{p.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
