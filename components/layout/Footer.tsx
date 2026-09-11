import Link from "next/link";
import { sv } from "@/lib/i18n/sv";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[var(--content-width)] flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>{sv.footer.noTracking}</p>
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
