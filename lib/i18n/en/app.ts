/** Shared across the service: app name, menus, footer, theme, common buttons, times and error pages. English counterpart of lib/i18n/sv/app.ts. */
import type { Dict } from "@/lib/i18n/types";

export const app: Dict["app"] = {
  name: "Kuggfri",
  tagline: "Flashcards for Chalmers students.",
  skipToContent: "Skip to content",
};

export const nav: Dict["nav"] = {
  menu: "Menu",
};

export const shell: Dict["shell"] = {
  mainNav: "Main menu",
  sectionStudy: "Study",
  sectionAdmin: "Administration",
  home: "Home",
  courses: "Courses",
  /** The course page (modes, topics, start a session) when there is only one course. */
  coursePage: "Course page",
  examMode: "Exam mode",
  examModeLocked: "Exam mode, locked",
  /** Shortcut to the admin start page with all courses (and New course for admins). */
  allCourses: "All courses",
  designSystem: "Design system",
  /** Counters on the admin tab shortcuts, in tooltips and screen reader text. */
  pendingDrafts: (n: number) => (n === 1 ? "1 card to review" : `${n} cards to review`),
  openReports: (n: number) => (n === 1 ? "1 open error report" : `${n} open error reports`),
  myStats: "My stats",
  infoNav: "Help and information",
  help: "Help",
  collapse: "Collapse sidebar",
  expand: "Expand sidebar",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  profileMenu: "Profile menu",
  account: "Account and settings",
  theme: "Theme",
  privacy: "Privacy",
  about: "About",
  logout: "Sign out",
};

export const footer: Dict["footer"] = {
  privacy: "Privacy policy",
  about: "About",
};

export const theme: Dict["theme"] = {
  label: "Colour theme",
  system: "Match system",
  light: "Light",
  dark: "Dark",
};

export const common: Dict["common"] = {
  cancel: "Cancel",
  confirm: "Confirm",
  close: "Close",
  save: "Save",
  delete: "Delete",
  back: "Back",
  loading: "Loading…",
  notFound: "This page does not exist.",
  forbiddenTitle: "Access denied",
  forbiddenBody: "You do not have permission to view this page.",
  toHome: "Go to home page",
  required: "Required",
};

export const time: Dict["time"] = {
  now: "now",
  today: "today",
  tomorrow: "tomorrow",
  inDays: (n: number) => (n === 1 ? "in 1 day" : `in ${n} days`),
  inMonths: (n: number) => (n === 1 ? "in a month" : `in ${n} months`),
  overdue: "overdue",
  justNow: "just now",
};

export const errors: Dict["errors"] = {
  generic: "Something went wrong. Try again.",
  pageTitle: "Something went wrong",
  pageBody: "An unexpected error occurred. Try again, or go to the home page.",
  retry: "Try again",
};

/** The language: locale controls dates and numbers (lib/time/stockholm, lib/format/number). */
export const meta: Dict["meta"] = {
  lang: "en",
  locale: "en-GB",
  ogLocale: "en_GB",
  /** The word before the time of day: "today at 14:32". */
  at: "at",
  language: "Language",
  languageHelp: "The whole service is shown in the chosen language, cards included, on all your devices. Students always see Swedish.",
  pct: (n: number | string) => `${n}%`,
  pctSuffix: "%",
};

/** Source types on the cards (lib/cards/sources) and the label when a source is missing. */
export const sourceTags: Dict["sourceTags"] = {
  forelasning: "Lecture",
  tenta: "Exam",
  quiz: "Quiz",
  ovning: "Exercise",
  labb: "Lab",
  bok: "Book",
  ordlista: "Glossary",
  kursdokument: "Course document",
  ovrigt: "Other",
  original: "Original card",
  ingen: "No source",
};
