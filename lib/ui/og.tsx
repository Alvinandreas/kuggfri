import type { ReactElement } from "react";
import { sv } from "@/lib/i18n/sv";

/**
 * Delningsbilden som visas när någon klistrar in en Kuggfri-länk i en gruppchatt.
 * Ett flashcard, inte en logotyp: det som lockar en student att trycka är att se
 * en fråga ur kursen.
 *
 * Färgerna upprepas här i stället för att läsas ur globals.css eftersom bilden
 * renderas på servern utan CSS-variabler. Håll dem i synk med :root.
 */
export const OG_SIZE = { width: 1200, height: 630 };

const BG = "#f6f5f1";
const SURFACE = "#ffffff";
const FG = "#1d1c19";
const MUTED = "#676259";
const LINE = "#dedbd3";
const ACCENT = "#1f7a4d";

export function ogCard(input: { title: string; subtitle: string; badge?: string | null; footer?: string | null }): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BG,
        padding: 64,
        fontFamily: "sans-serif",
      }}
    >
      {/* Kortet */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          flex: 1,
          background: SURFACE,
          border: `2px solid ${LINE}`,
          borderRadius: 28,
          padding: 56,
          justifyContent: "center",
        }}
      >
        {input.badge ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ background: ACCENT, color: "#ffffff", fontSize: 26, fontWeight: 600, padding: "8px 20px", borderRadius: 999 }}>{input.badge}</div>
          </div>
        ) : null}
        <div style={{ fontSize: input.title.length > 34 ? 64 : 78, fontWeight: 700, color: FG, lineHeight: 1.1 }}>{input.title}</div>
        <div style={{ fontSize: 34, color: MUTED, lineHeight: 1.3 }}>{input.subtitle}</div>
      </div>

      {/* Avsändaren */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 20, height: 44, background: ACCENT, borderRadius: 6 }} />
          <div style={{ fontSize: 40, fontWeight: 700, color: FG }}>{sv.app.name}</div>
        </div>
        {input.footer ? <div style={{ fontSize: 28, color: MUTED }}>{input.footer}</div> : null}
      </div>
    </div>
  );
}
