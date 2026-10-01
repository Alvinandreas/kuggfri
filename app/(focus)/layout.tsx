import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { routes } from "@/lib/routes";

/**
 * Fokusläge för pluggpasset: ingen sidomeny, bara kortet. Passet har en egen stängknapp
 * tillbaka till kursen.
 */
export default async function FocusLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect(routes.landing());
  // overflow-x-clip: stämpeln och kortets in- och utglidning får aldrig ge sidan en
  // horisontell rullning på mobilen (clip skapar ingen egen rullningsyta).
  return (
    <div className="flex w-full flex-1 flex-col overflow-x-clip">
      <main id="innehall" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
        {children}
      </main>
    </div>
  );
}
