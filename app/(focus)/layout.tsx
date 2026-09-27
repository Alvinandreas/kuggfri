import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Fokusläge för pluggpasset: ingen sidomeny, bara kortet. Passet har en egen stängknapp
 * tillbaka till kursen.
 */
export default async function FocusLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return (
    <main id="innehall" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
      {children}
    </main>
  );
}
