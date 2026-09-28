"use client";

import { useEffect, useRef, useState } from "react";
import { sv } from "@/lib/i18n/sv";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { googleClientId, safeNext, sha256Hex } from "@/lib/auth/google";

/**
 * "Fortsätt med Google" med Googles egen knapp (Google Identity Services). Inloggningsrutan
 * visar då Kuggfri och kuggfri.com, inte Supabase-projektets adress, och det kostar inget.
 *
 * Flödet: slumpa en engångskod (nonce), ge Google dess SHA-256, få tillbaka en ID-token och
 * lämna den till Supabase tillsammans med den råa koden (signInWithIdToken). Supabase kontrollerar
 * signaturen, att token är utfärdad till vårt klient-id och att koden stämmer, vilket stoppar
 * återuppspelade token. Google-adresser är redan verifierade, så inget bekräftelsemejl behövs,
 * och ett befintligt konto med samma adress kopplas ihop i stället för att dubbleras.
 *
 * Visas bara när NEXT_PUBLIC_GOOGLE_CLIENT_ID är satt.
 */

type Gsi = {
  accounts: {
    id: {
      initialize: (config: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
      cancel: () => void;
    };
  };
};

declare global {
  interface Window {
    google?: Gsi;
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadScript(): Promise<Gsi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => (window.google ? resolve(window.google) : reject(new Error("gsi"))));
    script.addEventListener("error", () => reject(new Error("gsi")));
  });
}

export function GoogleButton({ next, mode }: { next: string; mode: "login" | "register" }) {
  const clientId = googleClientId();
  const holder = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId || !holder.current) return;
    let cancelled = false;
    const el = holder.current;
    (async () => {
      try {
        const google = await loadScript();
        if (cancelled) return;
        const raw = crypto.getRandomValues(new Uint8Array(32));
        const nonce = Array.from(raw, (b) => b.toString(16).padStart(2, "0")).join("");
        const hashed = await sha256Hex(nonce);
        google.accounts.id.initialize({
          client_id: clientId,
          nonce: hashed,
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
          use_fedcm_for_button: true,
          callback: async (response: { credential?: string }) => {
            if (!response.credential) return;
            setBusy(true);
            setError(null);
            const { error: authError } = await createSupabaseBrowserClient().auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce,
            });
            if (authError) {
              console.error("[auth] google", authError.message);
              setError(sv.auth.googleError);
              setBusy(false);
              return;
            }
            // Full navigering, så att serverkomponenterna ser den nya sessionen.
            window.location.assign(safeNext(next));
          },
        });
        const dark = document.documentElement.classList.contains("dark");
        el.replaceChildren();
        google.accounts.id.renderButton(el, {
          type: "standard",
          theme: dark ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text: mode === "register" ? "signup_with" : "continue_with",
          logo_alignment: "center",
          locale: "sv",
          width: Math.min(400, Math.max(240, Math.round(el.getBoundingClientRect().width))),
        });
      } catch {
        if (!cancelled) setError(sv.auth.googleUnavailable);
      }
    })();
    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel();
    };
  }, [clientId, next, mode]);

  if (!clientId) return null;

  return (
    <div className="grid gap-4" data-testid="google-signin">
      {/* Googles knapp ritas i en iframe; min-höjden hindrar att formuläret hoppar när den laddas. */}
      <div ref={holder} className="flex min-h-[44px] justify-center" aria-busy={busy} />
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-2.5 text-center text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3 text-xs font-medium text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {sv.auth.orWithEmail}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
