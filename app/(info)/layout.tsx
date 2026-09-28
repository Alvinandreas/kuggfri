import { getCurrentUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { InfoTabs } from "@/components/layout/InfoNav";

/**
 * Hjälp, Om och integritet måste gå att läsa innan man skapar konto. Inloggade ser dem i
 * appskalet, som alla andra sidor; utloggade i den publika ramen. Flikarna överst binder
 * ihop sidorna; längst ner finns inga fler länkar (sidomenyn räcker).
 */
export default async function InfoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const content = (
    <>
      <InfoTabs />
      {children}
    </>
  );
  if (user) return <AppShell>{content}</AppShell>;
  return <PublicLayout>{content}</PublicLayout>;
}
