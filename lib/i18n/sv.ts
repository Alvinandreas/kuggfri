/**
 * Alla UI-strängar på svenska. Ändra i lib/i18n/sv/, inte i komponenterna.
 * Texterna ligger per område i lib/i18n/sv/*.ts; här sätts de ihop till ett objekt i samma
 * ordning som förut, så att alla importerar { sv } härifrån.
 */
import { app, common, errors, footer, nav, shell, theme, time } from "./sv/app";
import { dashboard, home, invite, landing } from "./sv/home";
import { help } from "./sv/help";
import { about, privacy } from "./sv/info";
import { focus, myStats, stats } from "./sv/stats";
import { deck } from "./sv/deck";
import { cardKind, dugga, passSettings, quick, quiz, report, session, study, summary } from "./sv/study";
import { account, auth } from "./sv/auth";
import { admin } from "./sv/admin";
import { granskning } from "./sv/granskning";
import { tenta } from "./sv/tenta";

export const sv = {
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
} as const;
