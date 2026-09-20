/**
 * Säkerhetsheaders.
 *
 * De statiska headrarna sätts i next.config.ts och gäller allt. Innehållspolicyn (CSP)
 * byggs här per request, eftersom den innehåller en nonce: Next.js läser headern från
 * requesten och märker sina egna inline-skript med samma nonce, och layouten gör detsamma
 * med temaskriptet. Då behövs inget `unsafe-inline` för skript.
 *
 * Allt appen laddar är lokalt (typsnitt, KaTeX-CSS, QR-koden ritas i webbläsaren), så
 * policyn kan hållas snäv. Det enda utgående anropet är till Supabase.
 */

export const NONCE_HEADER = "x-nonce";

/** Slumpmässig nonce, base64. Webbläsaren kräver att den skiljer sig mellan requests. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function supabaseOrigins(): string[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const { origin, host, protocol } = new URL(url);
    const ws = `${protocol === "https:" ? "wss" : "ws"}://${host}`;
    return [origin, ws];
  } catch {
    return [];
  }
}

export function buildCsp(nonce: string, isDev: boolean): string {
  const connect = ["'self'", ...supabaseOrigins()];
  // Dev-servern behöver eval för hot reload och websocket till sig själv.
  if (isDev) connect.push("ws:", "http://localhost:*");

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Tailwind och KaTeX injicerar stilar; style-src-attr krävs för inline style-attribut.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    // Bara i produktion: lokalt körs både appen och Supabase över http.
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** Headers som inte beror på requesten. Sätts i next.config.ts. */
export const STATIC_SECURITY_HEADERS = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  // Inramning är aldrig tillåten: appen har inget legitimt inbäddat läge, och en
  // inramad adminvy är en clickjacking-risk. CSP:ns frame-ancestors gör samma sak
  // för nyare webbläsare; den här finns för de äldre.
  { key: "X-Frame-Options", value: "DENY" },
  // Två år, utan preload: preload är svårt att ångra och kräver ett medvetet beslut.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Permissions-Policy",
    value: "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
] as const;

/**
 * Konstant-tidsjämförelse av en Bearer-token. Skillnaden mot `!==` är försumbar över
 * internet, men kostar två rader och tar bort frågan.
 */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const given = header ?? "";
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
