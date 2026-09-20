"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { sv } from "@/lib/i18n/sv";
import { Button } from "@/components/ui/Button";

type Props = { slug: string };

/**
 * Dela kursen: kopiera länk och visa QR-kod. Äger sin egen tillfälliga status
 * ("Kopierat!", QR synlig) eftersom ingen annan del av sidan bryr sig om den.
 */
export function ShareDeck({ slug }: Props) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  // QR-koden renderas först när den efterfrågas.
  useEffect(() => {
    if (!showQr || qrSvg) return;
    QRCode.toString(`${window.location.origin}/d/${slug}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then(setQrSvg)
      .catch(() => setQrSvg(null));
  }, [showQr, qrSvg, slug]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copyLink() {
    if (await copyToClipboard(`${window.location.origin}/d/${slug}`)) setCopied(true);
  }

  return (
    <section className="order-6 grid gap-4 text-sm text-muted">
      <div className="flex w-fit max-w-full flex-wrap items-center gap-x-8 gap-y-4 rounded-lg border border-line bg-surface p-5 shadow-card">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-fg">{sv.deck.share}</h2>
          <p className="mt-1">{sv.deck.shareHelp}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={copied ? "secondary" : "primary"}
            onClick={copyLink}
            aria-live="polite"
            className={copied ? "border-accent! bg-accent-soft! text-accent!" : ""}
            data-testid="copy-link"
          >
            {copied ? sv.deck.shareCopied : sv.deck.shareCopy}
          </Button>
          <Button variant="secondary" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr} data-testid="toggle-qr">
            {showQr ? sv.deck.hideQr : sv.deck.showQr}
          </Button>
        </div>
        {showQr ? (
          <div className="flex w-full flex-wrap items-center gap-4" data-testid="qr-code">
            {qrSvg ? (
              <div
                role="img"
                aria-label={sv.deck.qrAlt(`kuggfri.com/d/${slug}`)}
                className="h-44 w-44 shrink-0 rounded-md bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <span className="text-muted">{sv.common.loading}</span>
            )}
            <p className="max-w-xs">{sv.deck.qrHelp}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Reserv för webbläsare utan clipboard-API eller utan behörighet (Safari i iframe, http). */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      return document.execCommand("copy");
    } finally {
      ta.remove();
    }
  }
}
