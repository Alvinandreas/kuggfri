import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarClock, ChartNoAxesColumn, GraduationCap } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { safeNext } from "@/lib/auth/safe-next";
import { getCurrentUser } from "@/lib/supabase/server";
import { AuthPanel } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: { absolute: `${sv.app.name} – ${sv.landing.title}` } };

const ICONS = [CalendarClock, GraduationCap, ChartNoAxesColumn];

/**
 * Landningssidan: vad Kuggfri är, i tre rader, och formuläret. Inloggade skickas vidare
 * till hemsidan (eller dit länken de följde pekade). ?next= kommer från inloggningsgrinden
 * i middleware, ?flik=logga-in öppnar inloggningsfliken direkt.
 */
export default async function LandingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeNext(query.next, "/hem");
  const user = await getCurrentUser();
  if (user) redirect(next);
  const flik = Array.isArray(query.flik) ? query.flik[0] : query.flik;

  return (
    <div className="grid items-center gap-10 py-4 lg:min-h-[calc(100dvh-13rem)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
      <div className="anim-fade-up lg:col-start-1 lg:row-start-1 lg:self-end">
        <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-ink">{sv.landing.eyebrow}</p>
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">{sv.landing.title}</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">{sv.landing.lead}</p>
      </div>

      <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <AuthPanel next={next} initialTab={flik === "logga-in" ? "logga-in" : "registrera"} hint={next !== "/hem" ? sv.landing.nextHint : null} />
      </div>

      <ul className="grid gap-5 lg:col-start-1 lg:row-start-2 lg:self-start">
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
