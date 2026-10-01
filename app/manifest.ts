import type { MetadataRoute } from "next";
import { getT } from "@/lib/i18n/server";

/** Webbappsmanifest: "Lägg till på hemskärmen" ger en riktig appikon och eget fönster. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const sv = await getT();
  return {
    name: sv.app.name,
    short_name: sv.app.name,
    description: sv.app.tagline,
    lang: sv.meta.lang,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f1",
    theme_color: "#1f7a4d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
