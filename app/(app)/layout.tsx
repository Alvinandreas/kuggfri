import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";

/** Sidor för inloggade, i appskalet med sidomeny. Middleware släpper aldrig hit utloggade; det här är en andra spärr. */
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return <AppShell>{children}</AppShell>;
}
