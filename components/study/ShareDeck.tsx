"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Link2, QrCode } from "lucide-react";
import { SITE_HOST } from "@/lib/contact";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { routes } from "@/lib/routes";

type Props = { slug: string };

/**
 * Dela kursen: kopiera länk och visa QR-kod. Äger sin egen tillfälliga status
 * ("Kopierat!", QR synlig) eftersom ingen annan del av sidan bryr sig om den.
 */
export function ShareDeck({ slug }: Props) {
  const sv = useT();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  // QR-koden renderas först när den efterfrågas.
  useEffect(() => {
    if (!showQr || qrSvg) return;
    QRCode.toString(`${window.location.origin}${routes.deck(slug)}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then(setQrSvg)
      .catch(() => setQrSvg(null));
  }, [showQr, qrSvg, slug]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copyLink() {
    if (await copyToClipboard(`${window.location.origin}${routes.deck(slug)}`)) setCopied(true);
  }

  return (
    <Card padding="lg" role="region" aria-labelledby="dela-rubrik" className="anim-fade-up order-6" style={{ ["--i" as string]: 3 }}>
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h2 id="dela-rubrik" className="text-lg font-bold tracking-tight">
            {sv.deck.share}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{sv.deck.shareHelp}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={copied ? "secondary" : "primary"}
            onClick={copyLink}
            aria-live="polite"
            className={copied ? "bg-accent-soft! text-accent-ink!" : ""}
            data-testid="copy-link"
          >
            {copied ? null : <Link2 size={17} aria-hidden />}
            {copied ? sv.deck.shareCopied : sv.deck.shareCopy}
          </Button>
          <Button variant="secondary" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr} data-testid="toggle-qr">
            <QrCode size={17} aria-hidden />
            {showQr ? sv.deck.hideQr : sv.deck.showQr}
          </Button>
        </div>
      </div>
      {showQr ? (
        <div className="anim-fade-in mt-5 flex flex-wrap items-center gap-5 rounded-lg bg-surface-2 p-4 text-sm text-muted" data-testid="qr-code">
          {qrSvg ? (
            <div
              role="img"
              aria-label={sv.deck.qrAlt(`${SITE_HOST}${routes.deck(slug)}`)}
              className="h-44 w-44 shrink-0 rounded-md bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <span>{sv.common.loading}</span>
          )}
          <p className="max-w-xs">{sv.deck.qrHelp}</p>
        </div>
      ) : null}
    </Card>
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
