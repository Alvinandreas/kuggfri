import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { safeNext } from "@/lib/auth/safe-next";
import { getCurrentUser } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: sv.auth.loginTitle };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeNext(query.next);
  const user = await getCurrentUser();
  if (user) redirect(next);
  const initialError = query.fel === "lank" ? sv.auth.callbackError : null;
  return <LoginForm next={next} initialError={initialError} />;
}
