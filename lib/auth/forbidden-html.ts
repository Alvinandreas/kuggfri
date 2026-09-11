import { sv } from "@/lib/i18n/sv";

/** Minimal 403-sida som middleware kan svara med utan att rendera React. */
export function forbiddenHtml(): string {
  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${sv.common.forbiddenTitle} – ${sv.app.name}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f6f5f1;color:#1d1c19;margin:0;display:grid;place-items:center;min-height:100vh}
  main{max-width:28rem;padding:2rem;text-align:center}
  a{color:#2f5d62}
  @media (prefers-color-scheme:dark){body{background:#151514;color:#ebe8e1}a{color:#8dbdc2}}
</style>
</head>
<body>
<main>
<h1>${sv.common.forbiddenTitle}</h1>
<p>${sv.common.forbiddenBody}</p>
<p><a href="/">${sv.common.toHome}</a></p>
</main>
</body>
</html>`;
}
