import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.auth.forgotTitle };
}

/** Glömt lösenord: mejlar en återställningslänk som loggar in och leder till lösenordsbytet under Konto. */
export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect(routes.account());
  return <ForgotPasswordForm />;
}
