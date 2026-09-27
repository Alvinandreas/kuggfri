import { getCurrentUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProgressMigrator } from "@/components/auth/ProgressMigrator";

/** Sajtens klassiska layout: sidhuvud, centrerad innehållskolumn och sidfot. */
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <>
      <Header />
      <main id="innehall" className="mx-auto w-full max-w-[var(--content-width)] flex-1 px-4 pb-16 pt-6 sm:px-6">
        <ProgressMigrator userId={user?.id ?? null} />
        {children}
      </main>
      <Footer />
    </>
  );
}
