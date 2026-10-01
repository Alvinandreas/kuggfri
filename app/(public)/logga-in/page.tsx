import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { safeNext } from "@/lib/auth/safe-next";
import { getCurrentUser } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/AuthForms";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.auth.loginTitle };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeNext(query.next, routes.home());
  const user = await getCurrentUser();
  if (user) redirect(next);
  const sv = await getT();
  const initialError = query.fel === "lank" ? sv.auth.callbackError : query.fel === "google" ? sv.auth.googleError : null;
  // En använd eller utgången bekräftelselänk är inget fel i sig: kontot kan redan vara bekräftat.
  const initialNotice = query.fel === "bekraftelse" ? sv.auth.confirmLinkError : null;
  return <LoginForm next={next} initialError={initialError} initialNotice={initialNotice} />;
}
