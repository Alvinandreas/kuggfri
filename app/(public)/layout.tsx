import { PublicLayout } from "@/components/layout/PublicLayout";

/** Landningssidan och inloggningsflödet: det enda en utloggad besökare når. */
export default function PublicGroupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PublicLayout wide>{children}</PublicLayout>;
}
