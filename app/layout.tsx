import type { Metadata, Viewport } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { getLang, getT } from "@/lib/i18n/server";
import { LangProvider } from "@/lib/i18n/client";
import { saveLanguageAction } from "@/lib/i18n/actions";
import { NONCE_HEADER } from "@/lib/security/headers";
import { getSiteUrl } from "@/lib/supabase/env";

// Figtree (OFL) buntas från npm i stället för att hämtas från Google vid bygget: bygget
// fungerar offline och besökarens webbläsare pratar aldrig med Google. Latin-delen täcker å, ä och ö.
const figtree = localFont({
  src: "../node_modules/@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2",
  weight: "300 900",
  variable: "--font-figtree",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return {
  // Absolut bas för delningsbilderna: utan den blir og:image en relativ adress som
  // ingen chattklient kan hämta.
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: sv.app.name,
    template: `%s – ${sv.app.name}`,
  },
  description: sv.app.tagline,
  // Det en länk i en gruppchatt visar upp. Sidorna är noindex, men länkförhandsvisningar
  // hämtas ändå – och det är så studenterna sprider tjänsten vidare.
  openGraph: {
    type: "website",
    siteName: sv.app.name,
    locale: sv.meta.ogLocale,
    title: sv.app.name,
    description: sv.app.tagline,
  },
  twitter: { card: "summary_large_image" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  applicationName: sv.app.name,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: sv.app.name, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#101111" },
  ],
};

/**
 * Sätter temat och sidomenyns läge innan första målningen så att sidan inte blinkar
 * eller hoppar när den hopfällda menyn annars skulle ha ritats utfälld först.
 */
const themeScript = `(function(){try{var h=document.documentElement;var t=localStorage.getItem('kuggfri:theme');var d=t==='dark'||((t===null||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);h.classList.toggle('dark',d);if(localStorage.getItem('kuggfri:sidebar')==='collapsed')h.dataset.sidebar='collapsed';}catch(e){}})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headerList = await headers();
  // Nonce från middleware, så att temaskriptet släpps igenom av innehållspolicyn.
  const nonce = headerList.get(NONCE_HEADER) ?? undefined;
  const lang = await getLang();
  const sv = await getT();
  return (
    <html lang={lang} className={figtree.variable} suppressHydrationWarning>
      <head>
        {/* React skickar medvetet inte nonce till klienten, så attributet skiljer sig mellan
            server och klient. Skriptet har redan körts när hydreringen sker; varningen
            dämpas här i stället för att tas om hand (inget går sönder). */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-bg text-fg antialiased">
        <a
          href="#innehall"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-card"
        >
          {sv.app.skipToContent}
        </a>
        <LangProvider lang={lang} save={saveLanguageAction}>
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
