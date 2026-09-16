import Image from "next/image";
import { sv } from "@/lib/i18n/sv";

type Props = {
  /** Höjd i px. Sidhuvudet använder 40, sidor som presenterar tjänsten 80. */
  height?: number;
  /** Dekorativ (tom alt) när texten "Kuggfri" redan finns intill. */
  decorative?: boolean;
  className?: string;
  priority?: boolean;
};

// public/logo-*.png är Alvins original beskuret till innehållet, 200 px högt.
const RATIO = 4196 / 2223;

/**
 * Kuggfris logotyp, oförändrad komposition från originalet. Två färgvarianter:
 * vit på mörkt tema (originalet), mörkt bläck på ljust tema (annars syns den inte).
 * Båda renderas och temat väljer med CSS, så bytet sker utan blink.
 */
export function Logo({ height = 40, decorative = false, className = "", priority = false }: Props) {
  const width = Math.round(height * RATIO);
  const alt = decorative ? "" : sv.app.name;
  return (
    <span className={`inline-flex shrink-0 items-center ${className}`.trim()} style={{ height }}>
      <Image src="/logo-light.png" alt={alt} width={width} height={height} priority={priority} className="block h-full w-auto dark:hidden" />
      <Image src="/logo-dark.png" alt="" width={width} height={height} priority={priority} className="hidden h-full w-auto dark:block" aria-hidden />
    </span>
  );
}
