import { ImageResponse } from "next/og";
import { sv } from "@/lib/i18n/sv";
import { ogCard, OG_SIZE } from "@/lib/ui/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = sv.app.name;

/** Delningsbild för startsidan: det en länk i en gruppchatt visar upp. */
export default function Image() {
  return new ImageResponse(ogCard({ title: sv.app.tagline, subtitle: sv.home.lead }), size);
}
