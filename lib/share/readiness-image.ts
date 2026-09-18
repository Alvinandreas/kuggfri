/**
 * Delbar beredskapsbild: "Jag kan 64 % av Materialteknik". Ritas i en canvas i webbläsaren
 * (ingen server, ingen spårning) och delas med Web Share API där det finns, annars laddas ned.
 * docs/OMVARLDSANALYS.md 5: det är beredskapen som blir skärmdumpad, inte streaken.
 */
export type ReadinessCard = {
  deckTitle: string;
  /** Andel 0–1 av korten studenten uppskattas kunna just nu. */
  share: number;
  streak: number;
  reviewed: number;
  total: number;
  /** T.ex. "kuggfri.com/d/materialteknik" */
  url: string;
  date: Date;
};

export const IMAGE_SIZE = 1080;

const COLORS = {
  bg: "#f6f5f1",
  surface: "#ffffff",
  fg: "#1d1c19",
  muted: "#676259",
  accent: "#1f7a4d",
  accentSoft: "#dcefe3",
  line: "#dedbd3",
};

export function readinessHeadline(card: ReadinessCard): string {
  return `Jag kan ${Math.round(card.share * 100)} % av ${card.deckTitle}`;
}

export function readinessSubline(card: ReadinessCard): string {
  const parts = [`${card.reviewed} av ${card.total} kort repeterade`];
  if (card.streak > 0) parts.push(card.streak === 1 ? "1 dag i rad" : `${card.streak} dagar i rad`);
  return parts.join(" · ");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Ritar bilden. Returnerar false om canvas inte kan användas. */
export function drawReadiness(canvas: HTMLCanvasElement, card: ReadinessCard): boolean {
  canvas.width = IMAGE_SIZE;
  canvas.height = IMAGE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const S = IMAGE_SIZE;
  const font = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, S, S);

  // Kortet
  ctx.fillStyle = COLORS.surface;
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 3;
  roundRect(ctx, 80, 120, S - 160, S - 240, 40);
  ctx.fill();
  ctx.stroke();

  // Kurs
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 34px ${font}`;
  ctx.textBaseline = "top";
  ctx.fillText(card.deckTitle.toUpperCase(), 140, 190);

  // Procent
  ctx.fillStyle = COLORS.accent;
  ctx.font = `700 260px ${font}`;
  ctx.fillText(`${Math.round(card.share * 100)} %`, 130, 250);

  // Rubrik
  ctx.fillStyle = COLORS.fg;
  ctx.font = `600 54px ${font}`;
  const lines = wrap(ctx, `kan jag just nu, enligt schemat`, S - 280);
  let y = 560;
  for (const l of lines) {
    ctx.fillText(l, 140, y);
    y += 68;
  }

  // Stapel
  y += 20;
  ctx.fillStyle = COLORS.accentSoft;
  roundRect(ctx, 140, y, S - 280, 28, 14);
  ctx.fill();
  ctx.fillStyle = COLORS.accent;
  roundRect(ctx, 140, y, Math.max(28, (S - 280) * Math.min(1, card.share)), 28, 14);
  ctx.fill();

  // Underrad
  y += 70;
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 36px ${font}`;
  ctx.fillText(readinessSubline(card), 140, y);

  // Datum och URL
  ctx.font = `400 30px ${font}`;
  const date = new Intl.DateTimeFormat("sv-SE", { dateStyle: "long" }).format(card.date);
  ctx.fillText(date, 140, S - 210);
  ctx.fillStyle = COLORS.accent;
  ctx.font = `600 34px ${font}`;
  ctx.fillText(card.url, 140, S - 160);
  return true;
}

/** Delar bilden via Web Share API där det finns (mobil), annars laddas den ned. Returnerar "shared" | "downloaded" | "failed". */
export async function shareReadiness(canvas: HTMLCanvasElement, card: ReadinessCard): Promise<"shared" | "downloaded" | "failed"> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], "kuggfri-beredskap.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: readinessHeadline(card), text: readinessHeadline(card) });
      return "shared";
    } catch {
      // Avbruten delning: fall tillbaka på nedladdning.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kuggfri-beredskap.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
