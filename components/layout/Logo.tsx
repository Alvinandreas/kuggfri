import Image from "next/image";
import { sv } from "@/lib/i18n/sv";

type Props = {
  /** Märkets höjd i px. Sidhuvudet använder 36, sidor som presenterar tjänsten 64–80. */
  height?: number;
  /** Bara märket (kugghjul + bock), utan ordmärke. */
  markOnly?: boolean;
  /** Dekorativ (tom alt) när texten "Kuggfri" redan finns intill. */
  decorative?: boolean;
  className?: string;
  priority?: boolean;
};

// Bildernas proportioner (public/logo-*.png är 200 px höga, märket 512×512).
const MARK = { w: 512, h: 512 };
const TEXT_RATIO = 2.940; // bredd/höjd för logo-text-*.png
/** Ordmärkets höjd i förhållande till märket. Originalet har ~0,45; lite större läses bättre i små storlekar. */
const TEXT_SCALE = 0.56;

/**
 * Kuggfris logotyp: märke + ordmärke, i två färgvarianter (mörkt bläck på ljust tema,
 * vitt på mörkt). Båda varianterna renderas och temat väljer med CSS, så bytet sker utan blink.
 */
export function Logo({ height = 36, markOnly = false, decorative = false, className = "", priority = false }: Props) {
  const alt = decorative ? "" : sv.app.name;
  const textH = Math.round(height * TEXT_SCALE);
  const textW = Math.round(textH * TEXT_RATIO);
  const markW = Math.round((MARK.w * height) / MARK.h);
  return (
    <span className={`inline-flex shrink-0 items-center ${className}`.trim()} style={{ height, gap: Math.round(height * 0.22) }}>
      <Image src="/logo-mark-light.png" alt={alt} width={markW} height={height} priority={priority} className="block h-full w-auto dark:hidden" />
      <Image src="/logo-mark-dark.png" alt="" width={markW} height={height} priority={priority} className="hidden h-full w-auto dark:block" aria-hidden />
      {markOnly ? null : (
        <>
          <Image src="/logo-text-light.png" alt="" width={textW} height={textH} priority={priority} className="block w-auto dark:hidden" style={{ height: textH }} aria-hidden />
          <Image src="/logo-text-dark.png" alt="" width={textW} height={textH} priority={priority} className="hidden w-auto dark:block" style={{ height: textH }} aria-hidden />
        </>
      )}
    </span>
  );
}
