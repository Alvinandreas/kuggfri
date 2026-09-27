import { getCurrentUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { PublicLayout } from "@/components/layout/PublicLayout";

/**
 * Om och integritet måste gå att läsa innan man skapar konto. Inloggade ser dem i
 * appskalet, som alla andra sidor; utloggade i den publika ramen.
 */
export default async function InfoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (user) return <AppShell>{children}</AppShell>;
  return <PublicLayout>{children}</PublicLayout>;
}
