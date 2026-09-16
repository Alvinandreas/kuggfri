import Image from "next/image";
import { sv } from "@/lib/i18n/sv";

type Props = {
  /** Höjd i px. Sidhuvudet använder 40, sidor som presenterar tjänsten 80. */
  height?: number;
  /** "menu": varianten med större ordmärke (sidhuvudet). "full": originalet. */
  variant?: "menu" | "full";
  /** Dekorativ (tom alt) när texten "Kuggfri" redan finns intill. */
  decorative?: boolean;
  className?: string;
  priority?: boolean;
};

// Bildernas bredd/höjd (fylls i av scripts/build-logo.py: se public/logo-*.png).
const RATIO = { full: 4196 / 2223, menu: 2.3062 };

/**
 * Kuggfris logotyp, oförändrad komposition från Alvins filer. Två färgvarianter:
 * vit på mörkt tema (originalet), mörkt bläck på ljust tema (annars syns den inte).
 * Båda renderas och temat väljer med CSS, så bytet sker utan blink.
 */
export function Logo({ height = 40, variant = "full", decorative = false, className = "", priority = false }: Props) {
  const width = Math.round(height * RATIO[variant]);
  const alt = decorative ? "" : sv.app.name;
  const base = variant === "menu" ? "/logo-menu" : "/logo";
  return (
    <span className={`inline-flex shrink-0 items-center ${className}`.trim()} style={{ height }}>
      <Image src={`${base}-light.png`} alt={alt} width={width} height={height} priority={priority} className="block h-full w-auto dark:hidden" />
      <Image src={`${base}-dark.png`} alt="" width={width} height={height} priority={priority} className="hidden h-full w-auto dark:block" aria-hidden />
    </span>
  );
}
