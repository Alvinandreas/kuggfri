import { ArrowRight, Lock } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { routes } from "@/lib/routes";

/**
 * Inloggad men inte på kursens deltagarlista (lib/enrollment/access.ts): kursens namn, varför
 * den inte syns och vilken adress man är inloggad med, så att den som läser kursen under en
 * annan adress vet vad som är fel. Inga kort och inget annat ur kursen.
 */
export async function NoCourseAccess({ deck }: { deck: { title: string; course_code: string | null } }) {
  const [sv, user] = await Promise.all([getT(), getCurrentUser()]);
  return (
    <div className="py-6">
      <Card padding="lg" className="anim-fade-up mx-auto max-w-2xl text-center" data-testid="no-course-access">
        <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-fg">
          <Lock size={28} strokeWidth={1.8} aria-hidden />
        </span>
        <p className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
          <span>{deck.title}</span>
          {deck.course_code ? <Badge tone="outline">{deck.course_code}</Badge> : null}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{sv.deck.noAccessTitle}</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted">{sv.deck.noAccessBody}</p>
        {user?.email ? <p className="mx-auto mt-2 max-w-lg text-muted">{sv.deck.noAccessEmail(user.email)}</p> : null}
        <div className="mt-7 flex justify-center">
          <LinkButton href={routes.home()}>
            {sv.common.toHome}
            <ArrowRight size={17} aria-hidden />
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
