/**
 * Alla UI-strängar på engelska, för den som slagit på reglaget English. Samma form som
 * lib/i18n/sv.ts (typen Dict kontrollerar att inget saknas); texterna ligger per område i
 * lib/i18n/en/*.ts. Termerna följer granskningens engelska och kursens eget material.
 */
import type { Dict } from "./types";
import { app, common, errors, footer, meta, nav, shell, sourceTags, theme, time } from "./en/app";
import { dashboard, home, invite, landing } from "./en/home";
import { help } from "./en/help";
import { about, privacy } from "./en/info";
import { focus, myStats, stats } from "./en/stats";
import { deck } from "./en/deck";
import { cardKind, dugga, passSettings, quick, quiz, report, session, study, summary } from "./en/study";
import { account, auth } from "./en/auth";
import { admin } from "./en/admin";
import { granskning } from "./en/granskning";
import { tenta } from "./en/tenta";

export const en: Dict = {
  meta,
  sourceTags,
  app,
  nav,
  shell,
  footer,
  theme,
  home,
  landing,
  help,
  focus,
  myStats,
  invite,
  dashboard,
  deck,
  stats,
  study,
  cardKind,
  quiz,
  summary,
  time,
  auth,
  account,
  common,
  admin,
  granskning,
  about,
  privacy,
  report,
  session,
  quick,
  passSettings,
  dugga,
  tenta,
  errors,
};
