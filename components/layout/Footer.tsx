import Link from "next/link";
import { sv } from "@/lib/i18n/sv";
import { ScrollTopLogo } from "./ScrollTopLogo";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[var(--content-width)] items-center justify-between gap-4 px-4 py-6 text-sm text-muted sm:px-6">
        <ScrollTopLogo />
        <nav aria-label={sv.footer.about} className="flex gap-4">
          <Link href="/om" className="hover:text-fg">
            {sv.footer.about}
          </Link>
          <Link href="/integritet" className="hover:text-fg">
            {sv.footer.privacy}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
