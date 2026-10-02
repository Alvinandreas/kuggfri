"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { googleLoginClientId } from "@/lib/auth/google";
import { buttonClass } from "@/components/ui/Button";
import { routes } from "@/lib/routes";

/**
 * "Fortsätt med Google": en vanlig knapp i designsystemet som skickar hela sidan till Googles
 * egen inloggningssida (via /auth/google, se lib/auth/google.ts). Ingen iframe från Google,
 * inget förifyllt namn eller profilbild och ingen dialog i webbläsaren.
 *
 * Logotypen är Googles fyrfärgade G, oförändrad, som Googles varumärkesregler kräver.
 * Visas bara när Google-inloggningen är påslagen (GOOGLE_LOGIN_ENABLED) och NEXT_PUBLIC_GOOGLE_CLIENT_ID är satt.
 */
export function GoogleButton({ next }: { next: string }) {
  const sv = useT();
  const [leaving, setLeaving] = useState(false);
  if (!googleLoginClientId()) return null;

  return (
    <div className="grid gap-4" data-testid="google-signin">
      <a
        href={routes.authGoogle({ next })}
        onClick={() => setLeaving(true)}
        aria-busy={leaving}
        className={buttonClass("outline", "lg", "w-full gap-3")}
        data-testid="google-signin-button"
      >
        <GoogleLogo />
        {leaving ? sv.auth.googleLeaving : sv.auth.googleContinue}
      </a>
      <div className="flex items-center gap-3 text-xs font-medium text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {sv.auth.orWithEmail}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false" className="shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
