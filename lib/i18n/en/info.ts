/** About Kuggfri and privacy. English counterpart of lib/i18n/sv/info.ts. */
import type { Dict } from "@/lib/i18n/types";

export const about: Dict["about"] = {
  /** The page title in the browser tab, as the entry in the sidebar. */
  title: "About",
  /** The heading on the page, below the logo. */
  heading: "About Kuggfri",
  intro:
    "Kuggfri is a free flashcard service for courses at Chalmers. It is built by a student, for students, and costs nothing.",
  why: "Why",
  whyBody: "Everything is open, free and without tracking.",
  how: "How it works",
  howBody:
    "Cards are reviewed according to FSRS, a spaced repetition algorithm that adapts the intervals to how well you knew each card. You can also study freely, in random order or with practice tests, and keep studying when today's session is done. Everything you study counts towards the schedule.",
  sources: "Content and sources",
  sourcesBody: "The cards are based on the course material. Credits per course:",
  noSource: "No source given.",
  teachers: "For course coordinators",
  teachersIntro:
    "Kuggfri is built so that a course can use it without extra work for the teacher, but with full insight and control if you want it.",
  teachersPoints: [
    "The content belongs to the course. All cards can be exported at any time as an ordinary file, with no lock-in.",
    "Students report errors straight from the card. Reports are collected per course with a link directly to the card, so the review happens where the error is.",
    "The course coordinator gets their own examiner view with a course overview: the hardest topics, tricky questions, how far the students have got and how many study each week. Everything is aggregated and anonymous, and is shown only once at least five students have rated.",
    "The examiner edits cards, topics and order themselves. The rights apply only to their own course.",
    "Editing happens in the browser with a preview of formulas and formatting. Import from CSV or JSON shows what will change before anything is saved.",
    "No costs, no ads, no tracking. Students create an account with name and email; all data is stored within the EU.",
  ],
  teachersOutro:
    "Would you like to use Kuggfri in your course, with your own examiner view? Get in touch with the person who runs Kuggfri (contact details above).",
  privacy: "Privacy",
  privacyBody:
    "We store only your name, your email and your study progress, nothing else. If you sign in with Google, we use only your name and your email from there. It is all in the privacy policy.",
  whoTitle: "Who's behind it",
  whoBody:
    "Kuggfri is built and run on a voluntary basis by a student at Chalmers University of Technology. It is not part of Chalmers' IT environment. If you find an error in a card, report it directly from the card and it goes to the course examiner. Otherwise you can reach us here:",
};

export const privacy: Dict["privacy"] = {
  title: "Privacy policy",
};
