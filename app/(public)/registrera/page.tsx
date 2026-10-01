import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { safeNext } from "@/lib/auth/safe-next";
import { getCurrentUser } from "@/lib/supabase/server";
import { RegisterForm } from "@/components/auth/AuthForms";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.auth.registerTitle };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeNext(query.next, routes.home());
  const user = await getCurrentUser();
  if (user) redirect(next);
  return <RegisterForm next={next} />;
}
