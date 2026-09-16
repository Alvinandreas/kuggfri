"use client";

import { sv } from "@/lib/i18n/sv";
import { Logo } from "./Logo";

/** Logotypen i sidfoten: ett klick scrollar mjukt till toppen av sidan. */
export function ScrollTopLogo() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={sv.footer.toTop}
      title={sv.footer.toTop}
      className="inline-flex items-center rounded-md opacity-90 transition-opacity hover:opacity-100"
    >
      <Logo variant="menu" height={32} decorative />
    </button>
  );
}
