import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { safeNext } from "@/lib/auth/safe-next";
import { getCurrentUser } from "@/lib/supabase/server";
import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: sv.auth.registerTitle };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeNext(query.next);
  const user = await getCurrentUser();
  if (user) redirect(next);
  return <RegisterForm next={next} />;
}
