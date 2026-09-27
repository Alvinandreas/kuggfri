import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getCurrentUser } from "@/lib/supabase/server";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: sv.auth.forgotTitle };

/** Glömt lösenord: mejlar en återställningslänk som loggar in och leder till lösenordsbytet under Konto. */
export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/konto");
  return <ForgotPasswordForm />;
}
