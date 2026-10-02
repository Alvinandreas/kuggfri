import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { safeNext } from "@/lib/auth/safe-next";
import { AuthCard } from "@/components/auth/AuthForms";
import { Button } from "@/components/ui/Button";
import { routes } from "@/lib/routes";

type LinkType = "signup" | "magiclink" | "recovery" | "email_change";

/** Mejlmallarnas typer; "email" är Supabase äldre namn på bekräftelsen av ett nytt konto. */
function linkType(value: string | undefined): LinkType | null {
  if (value === "signup" || value === "email") return "signup";
  return value === "magiclink" || value === "recovery" || value === "email_change" ? value : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.auth.linkTitle.signup, robots: { index: false, follow: false } };
}

/**
 * Mellansidan för länkar i mejl (app/auth/confirm/route.ts). Länken öppnar den här sidan, och
 * engångskoden förbrukas först när man trycker på knappen (ett POST). Mejlprogrammens
 * länkskannrar öppnar bara länkar, så de kan inte längre göra länken ogiltig före studenten.
 */
export default async function ConfirmLinkPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [sv, query] = await Promise.all([getT(), searchParams]);
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tokenHash = first(query.token_hash);
  const rawType = first(query.type);
  const type = linkType(rawType);
  const next = safeNext(first(query.next) ?? "/");

  if (!tokenHash || !type || !rawType) {
    return (
      <AuthCard>
        <div className="grid gap-5">
          <h1 className="text-2xl font-bold tracking-tight">{sv.auth.callbackError}</h1>
          <Link href={routes.login()} className="w-fit text-sm font-semibold text-accent underline-offset-2 hover:underline">
            {sv.auth.backToLogin}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <form method="post" action="/auth/confirm" className="grid gap-5" data-testid="confirm-link">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{sv.auth.linkTitle[type]}</h1>
          <p className="mt-1 text-muted">{sv.auth.linkLead}</p>
        </div>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={rawType} />
        <input type="hidden" name="next" value={next} />
        <Button type="submit" size="lg" data-testid="confirm-link-submit">
          {sv.auth.linkButton[type]}
        </Button>
      </form>
    </AuthCard>
  );
}
