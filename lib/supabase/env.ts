export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Saknar NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY. Kopiera .env.example till .env.local.",
    );
  }
  return { url, anonKey };
}

/**
 * Sajtens bas-URL. Används till återvändsadressen i inloggnings- och återställningsmejl,
 * till länkarna i påminnelserna och till og:image.
 *
 * Saknas NEXT_PUBLIC_SITE_URL i produktion är localhost aldrig rätt svar: då pekar varje
 * länk i varje mejl på studentens egen dator, och felet syns inte för någon annan än den
 * som klickar. Därför faller vi tillbaka på Vercels egen adress och skriver i loggen.
 * Bara anropsbar på servern (VERCEL_-variablerna finns inte i webbläsaren).
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) {
    console.error("[konfig] NEXT_PUBLIC_SITE_URL saknas. Använder", vercel, "– sätt variabeln i Vercel.");
    return `https://${vercel.replace(/\/$/, "")}`;
  }
  if (process.env.NODE_ENV === "production") {
    console.error("[konfig] NEXT_PUBLIC_SITE_URL saknas. Länkar i mejl kommer att peka på localhost.");
  }
  return "http://localhost:3000";
}
