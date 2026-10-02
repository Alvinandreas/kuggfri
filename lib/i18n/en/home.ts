/** Start page, landing page, invitations and the home page overview. English counterpart of lib/i18n/sv/home.ts. */
import type { Dict } from "@/lib/i18n/types";

export const home: Dict["home"] = {
  title: "Courses",
  lead: "All courses are free. Choose one to see the cards and start studying.",
  empty: "You have no courses yet. A course appears here once the examiner has added your email address to the course participant list.",
  cards: (n: number) => (n === 1 ? "1 card" : `${n} cards`),
  courseCode: "Course code",
};

export const landing: Dict["landing"] = {
  title: "Study smarter for the exam.",
  lead: "Kuggfri shows the right card on the right day, so what you learn sticks until the exam. Free and ad-free.",
  points: [
    { title: "Review at the right time", body: "The schedule learns what you know and brings up what you are about to forget." },
    { title: "Reviewed by the examiners", body: "The cards are based on the course's own material, with a source on every card, and are reviewed by the course examiners." },
    { title: "See where you stand", body: "Your knowledge per topic and a countdown to exam day." },
  ],
  formLabel: "Account",
  tabRegister: "Create account",
  tabLogin: "Sign in",
  registerTitle: "Create your account",
  registerLead: "It takes half a minute.",
  loginTitle: "Welcome back",
  loginLead: "Sign in to keep studying.",
  nextHint: "Sign in or create an account to open the course.",
};

export const invite: Dict["invite"] = {
  eyebrow: "You're invited to a course on Kuggfri",
  lead: "Create an account with the email address your course has for you, usually your Chalmers address, and the course opens right away. Free, ad-free, and the schedule shows the right card on the right day until the exam.",
};

export const dashboard: Dict["dashboard"] = {
  title: "Home",
  greeting: (hour: number, name: string) => {
    const who = name ? `, ${name}` : "";
    if (hour >= 5 && hour < 10) return `Good morning${who}`;
    if (hour >= 18 || hour < 5) return `Good evening${who}`;
    return `Hi${who}`;
  },
  leadDue: (n: number) => (n === 1 ? "One card is waiting for you today." : `${n} cards are waiting for you today.`),
  leadDone: "You're done for today. Nice work!",
  leadStart: "Choose a course to get started.",
  leadFirst: (n: number) =>
    `Your first session is ready: ${n === 1 ? "1 card" : `${n} cards`}, a few minutes. Rate honestly, so the schedule learns what you know.`,
  streak: (n: number) => (n === 1 ? "1-day streak" : `${n}-day streak`),
  streakLabel: "Streak",
  today: "Today's session",
  todayPlan: (due: number, fresh: number) =>
    [due > 0 ? `${due} to review` : null, fresh > 0 ? `${fresh} new` : null].filter(Boolean).join(", "),
  continue: "Continue studying",
  startFirst: "Start studying",
  doneTitle: "Done for today",
  doneBody: "The schedule has new cards for you tomorrow. Want to carry on now? You can keep studying, and that counts too.",
  moreNew: (n: number) => (n === 1 ? "Add 1 more new card" : `Add ${n} more new cards`),
  extra: "Keep studying",
  knowledge: "Knowledge",
  knowledgeHelp: "Share of the course's cards you know right now, according to the schedule.",
  examCountdown: "Time left to the exam",
  examPast: "The exam is over",
  openCourse: "Go to course",
  avg7: "Average rating",
  avg7Sub: "out of 5, past week",
  avg7None: "none in the past week",
  moreCourses: "More courses",
  allCourses: "All courses",
  cardsLeft: (n: number) => `${n} left today`,
  notStarted: "Not started",
  loading: "Loading your progress…",
};
