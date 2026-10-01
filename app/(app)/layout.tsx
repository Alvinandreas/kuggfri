import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { routes } from "@/lib/routes";

/** Sidor för inloggade, i appskalet med sidomeny. Middleware släpper aldrig hit utloggade; det här är en andra spärr. */
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect(routes.landing());
  return <AppShell>{children}</AppShell>;
}
