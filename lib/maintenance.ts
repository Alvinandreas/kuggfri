import { NextResponse, type NextRequest } from "next/server";

/**
 * Tillfällig avstängning av hela tjänsten.
 *
 * Sätts `UNDER_UTVECKLING=1` svarar varje sida med en enkel sida i stället för appen —
 * gäster, inloggade och admin lika. Grinden ligger först i middleware och svarar med egen
 * HTML, utan att röra databasen eller rendera någon sida. Den kan alltså inte råka släppa
 * igenom något av tjänsten.
 *
 * Egen förhandsvisning: sätt `FORHANDSVISNING_NYCKEL` till en lång slumpsträng och öppna
 * `https://…/?nyckel=DEN_STRÄNGEN`. Nyckeln sparas som kaka i den webbläsaren i en vecka.
 * Utan satt nyckel finns ingen väg förbi.
 */

const KAKA = "kuggfri-forhandsvisning";

export function underUtveckling(): boolean {
  const v = (process.env.UNDER_UTVECKLING ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "ja";
}

/** Konstant-tidsjämförelse: nyckeln ska inte gå att gissa fram tecken för tecken. */
function likaNycklar(given: string, förväntad: string): boolean {
  if (given.length !== förväntad.length) return false;
  let diff = 0;
  for (let i = 0; i < förväntad.length; i++) diff |= given.charCodeAt(i) ^ förväntad.charCodeAt(i);
  return diff === 0;
}

/**
 * Svar när tjänsten är avstängd, eller null när requesten ska gå vidare som vanligt.
 * Anropas först av allt i middleware.
 */
export function maintenanceGate(request: NextRequest): NextResponse | null {
  if (!underUtveckling()) return null;

  const nyckel = (process.env.FORHANDSVISNING_NYCKEL ?? "").trim();
  const { searchParams, protocol } = request.nextUrl;

  // ?nyckel=… sätter kakan och tar bort parametern ur adressen, så att nyckeln inte
  // blir kvar i adressfältet och syns på en projektorduk.
  const angiven = searchParams.get("nyckel");
  if (nyckel && angiven && likaNycklar(angiven, nyckel)) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("nyckel");
    const svar = NextResponse.redirect(url);
    // En vecka: kakan ska överleva att datorn startas om natten före en presentation.
    svar.cookies.set(KAKA, nyckel, {
      httpOnly: true,
      sameSite: "lax",
      secure: protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return svar;
  }

  const kaka = request.cookies.get(KAKA)?.value;
  if (nyckel && kaka && likaNycklar(kaka, nyckel)) return null;

  return new NextResponse(sidan(), {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": "86400",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function sidan(): string {
  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Kuggfri – under utveckling</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f5f1; --fg:#1d1c19; --muted:#676259; --accent:#1f7a4d; --line:#dedbd3; --yta:#ffffff; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#151514; --fg:#ebe8e1; --muted:#a6a097; --accent:#3aa868; --line:#2e2d2a; --yta:#1d1c1a; }
  }
  * { box-sizing: border-box; }
  body {
    margin:0; min-height:100dvh; display:grid; place-items:center; padding:24px;
    background:var(--bg); color:var(--fg);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height:1.55;
  }
  main { width:100%; max-width:30rem; background:var(--yta); border:1px solid var(--line); border-radius:16px; padding:40px 32px; }
  .märke { display:flex; align-items:center; gap:12px; margin-bottom:28px; }
  .stapel { width:14px; height:30px; background:var(--accent); border-radius:4px; }
  .namn { font-size:26px; font-weight:700; letter-spacing:-0.01em; }
  h1 { margin:0 0 12px; font-size:30px; line-height:1.2; letter-spacing:-0.02em; }
  p { margin:0 0 12px; color:var(--muted); }
  p:last-child { margin-bottom:0; }
</style>
</head>
<body>
  <main>
    <div class="märke"><div class="stapel"></div><div class="namn">Kuggfri</div></div>
    <h1>Under utveckling</h1>
    <p>Tjänsten är inte öppen än. Vi finslipar de sista bitarna och öppnar inom kort.</p>
    <p>Har du fått en länk av din kursansvarig? Spara den – den fungerar när vi öppnar.</p>
  </main>
</body>
</html>`;
}
