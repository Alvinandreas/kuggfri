import type { Metadata, Viewport } from "next";
import "./globals.css";
import { headers } from "next/headers";
import { sv } from "@/lib/i18n/sv";
import { NONCE_HEADER } from "@/lib/security/headers";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/env";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProgressMigrator } from "@/components/auth/ProgressMigrator";

export const metadata: Metadata = {
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
    locale: "sv_SE",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#151514" },
  ],
};

/** Sätter temat innan första målningen så att sidan inte blinkar. */
const themeScript = `(function(){try{var t=localStorage.getItem('kuggfri:theme');var d=t==='dark'||((t===null||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, headerList] = await Promise.all([getCurrentUser(), headers()]);
  // Nonce från middleware, så att temaskriptet släpps igenom av innehållspolicyn.
  const nonce = headerList.get(NONCE_HEADER) ?? undefined;
  return (
    <html lang="sv" suppressHydrationWarning>
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
        <Header />
        <main id="innehall" className="mx-auto w-full max-w-[var(--content-width)] flex-1 px-4 pb-16 pt-6 sm:px-6">
          <ProgressMigrator userId={user?.id ?? null} />
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
