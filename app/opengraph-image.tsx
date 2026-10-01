import { ImageResponse } from "next/og";
import { dictionary } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { ogCard, OG_SIZE } from "@/lib/ui/og";

export const size = OG_SIZE;
export const contentType = "image/png";
// Alt-texten måste vara statisk: delningsbilden för länkar har alltid den svenska.
export const alt = dictionary("sv").app.name;

/** Delningsbild för startsidan: det en länk i en gruppchatt visar upp. */
export default async function Image() {
  const sv = await getT();
  return new ImageResponse(ogCard({ title: sv.app.tagline, subtitle: sv.home.lead }, sv), size);
}
