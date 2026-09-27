import { getCurrentUser } from "@/lib/supabase/server";
import { GuestBanner } from "@/components/study/GuestBanner";

export default async function DeckLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      {user ? null : <GuestBanner />}
      {children}
    </>
  );
}
