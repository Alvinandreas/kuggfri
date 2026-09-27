"use client";

import type { SelfRating } from "@/lib/progress/types";
import { createBrowserSetting } from "./browser-setting";

/** Ljudet är på som standard; bara "av" sparas. */
export const SOUND_KEY = "kuggfri:sound";

const soundSetting = createBrowserSetting<boolean>(
  SOUND_KEY,
  true,
  (raw) => raw !== "off",
  (on) => (on ? null : "off"),
);

export const useSoundEnabled = soundSetting.useSetting;

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** En kort ton med mjuk attack och avklingning, så att det aldrig klickar. */
function tone(ac: AudioContext, freq: number, start: number, length: number, type: OscillatorType, peak: number, glideTo?: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/**
 * Ljudet efter en skattning, syntetiserat i webbläsaren (inga ljudfiler att ladda):
 * 4–5 ett ljust, stigande pling (5 med en ton till), 3 en neutral ton, 1–2 ett dovt,
 * sjunkande "bonk". Tyst om ljudet är avstängt eller webbläsaren saknar Web Audio.
 */
export function playRatingSound(rating: SelfRating) {
  if (!soundSetting.read()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  if (rating >= 4) {
    tone(ac, 659.25, t, 0.16, "sine", 0.09);
    tone(ac, 987.77, t + 0.08, 0.22, "sine", 0.08);
    if (rating === 5) tone(ac, 1318.5, t + 0.16, 0.28, "sine", 0.06);
  } else if (rating === 3) {
    tone(ac, 587.33, t, 0.18, "sine", 0.07);
  } else {
    tone(ac, 220, t, 0.24, "triangle", 0.1, 150);
  }
}
