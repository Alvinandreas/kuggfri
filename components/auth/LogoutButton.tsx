"use client";

import { useTransition } from "react";
import { sv } from "@/lib/i18n/sv";
import { signOutAction } from "@/lib/auth/actions";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => signOutAction())}
      disabled={pending}
      className="rounded-md px-2 py-1.5 text-muted hover:text-fg disabled:opacity-60"
    >
      {sv.nav.logout}
    </button>
  );
}
