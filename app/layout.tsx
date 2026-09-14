import type { Metadata, Viewport } from "next";
import "./globals.css";
import { sv } from "@/lib/i18n/sv";
import { getCurrentUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProgressMigrator } from "@/components/auth/ProgressMigrator";

export const metadata: Metadata = {
  title: {
    default: sv.app.name,
    template: `%s – ${sv.app.name}`,
  },
  description: sv.app.tagline,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  applicationName: sv.app.name,
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
  const user = await getCurrentUser();
  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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
