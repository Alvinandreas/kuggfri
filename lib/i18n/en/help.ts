/** The help page. English counterpart of lib/i18n/sv/help.ts. */
import type { Dict } from "@/lib/i18n/types";

export const help: Dict["help"] = {
  title: "Help",
  lead: "How to use Kuggfri, from your first session to exam day. Answers to common questions are at the bottom.",
  tocLabel: "On this page",
  sections: {
    start: "Get started",
    schedule: "How the schedule works",
    modes: "The modes",
    rating: "Rating scale 1–5",
    keys: "Keyboard shortcuts",
    session: "During a session",
    home: "Home page and radar chart",
    stats: "My stats",
    account: "Account and data",
    faq: "Common questions",
    more: "More help",
  },
  startSteps: [
    {
      title: "Create an account",
      body: "Name, email and password. It takes half a minute. If you got a course link, you land straight in the course afterwards.",
    },
    {
      title: "Open today's session",
      body: "The home page shows how many cards are waiting today. “Continue studying” takes you to the course page.",
    },
    {
      title: "Choose a mode",
      body: "On the course page you choose how you want to study. Scheduled review is the usual choice, every day.",
    },
    {
      title: "Flip and rate",
      body: "Think of the answer, flip the card and rate honestly from 1 to 5. The rating decides when the card comes back.",
    },
  ],
  scheduleLead:
    "Kuggfri uses FSRS, a spaced repetition algorithm. You don't need to plan anything yourself: the schedule picks which cards you see each day.",
  schedulePoints: [
    {
      title: "The right card on the right day",
      body: "A card comes back roughly when you would otherwise have started to forget it. Each time you know it, the interval gets longer.",
    },
    {
      title: "Rate honestly",
      body: "The schedule learns from your ratings. Ratings that are too high postpone cards you don't know; ratings that are too low give you reviews you don't need.",
    },
    {
      title: "New cards per day",
      body: "You get 20 new cards per day unless you choose 10 or 40 under Study pace on the account page. Cards due for review are always included, whatever the daily goal.",
    },
    {
      title: "Study as much as you like",
      body: "Today's session is the floor, not the ceiling. When it's done you can always choose Keep studying: first the cards that are soon due for review, then new cards, with no limit. Everything counts towards the schedule, just like free review, tricky cards and practice tests. If you review a card before it is due, the interval grows a little less than if you had waited, and several reviews on the same day don't give a longer interval. Extra study is never wasted, and the schedule is not fooled.",
    },
    {
      title: "The exam date",
      body: "If the course has an exam date, the schedule plans towards it: all cards are introduced in good time, no card is pushed past the exam, and the last few days become a final review of everything, weakest first. If you fall behind, the daily goal is raised openly, in a catch-up mode. After the exam the schedule carries on long-term.",
    },
    {
      title: "Streak and freezes",
      body: "Your streak counts days in a row with at least one review. Two streak freezes cover the odd missed day, and you get a new freeze every seventh active day. If you prefer to study on weekdays, you can choose that under Account, so weekends don't count as missed.",
    },
  ],
  modesLead: "You choose a mode on the course page and set up the session under Settings in Your session. Your choices are saved for next time. Every rating counts towards the schedule, whatever the mode.",
  modes: {
    fsrs: "New and due cards. Your rating decides when the card comes back, and cards you rate 1 or 2 come back later in the same session. You can take fewer cards than today's, skip new cards and only review, or take one topic at a time. When today's session is done, you can keep studying for as long as you like.",
    tricky: "Only cards you have rated 1 or 2, and cards you have never seen. A card you now know stops counting as tricky. You choose how many, whether the hardest come first and whether unseen cards are included.",
    free: "Browse freely through a selection, as many times as you like. Good for learning a topic. You choose how many, the order (weakest first, course order or random) and whether you want flip cards, auto-graded cards or both.",
    random: "The whole course in random order. Good for checking that you know the cards without the order helping you. You choose how many and the question types, and can limit the session to the topics you have ticked.",
    exam: "Before the practice test you choose the number of questions (10, 20, 30 or all), whether hints are allowed and whether to show a timer. Afterwards you see where you stand.",
  },
  affectsSchedule: "Counts in the schedule",
  ratingLead: "After each card you rate how well you knew it. The buttons show when the card comes back (except in the practice test).",
  rating: {
    1: "You couldn't come up with the answer. The card comes back in the same session and soon after.",
    2: "Close, but not right. Counts as a miss: the card comes back in the same session.",
    3: "Right, but it took effort. The card comes back fairly soon.",
    4: "Right after a moment's thought. Normal interval.",
    5: "You knew it instantly. Longest interval, and the card counts as learned.",
  } as Record<1 | 2 | 3 | 4 | 5, string>,
  ratingNote: "Cards rated 1 or 2 end up among your tricky cards until you rate them higher.",
  keysLead: "On a computer with a keyboard, you can run the whole session without a mouse.",
  keys: {
    space: "Space",
    flip: "Flip the card",
    rate: "Rate the card",
    nav: "Previous or next card",
    hint: "Show hint, if the card has one",
    pick: "Answer a multiple-choice question",
    answer: "Answer, and move on after answering",
  },
  sessionLead: "Below the rating buttons there is a row of small icons, and there are a few more on the card itself.",
  sessionTools: {
    info: { title: "Instructions", body: "The info button shows how the session works." },
    sound: {
      title: "Sound",
      body: "The speaker turns the sound effects on or off. The same button is also on the card.",
    },
    report: {
      title: "Report an error",
      body: "The flag opens a report about the card. It goes to the course examiner.",
    },
    star: {
      title: "Star",
      body: "The star on the card marks it. Choose the “Starred” mode on the course page to study only those, and see all your starred cards there.",
    },
  },
  homeBody:
    "The home page shows today's session, your streak, your knowledge and the time left to the exam. The Tricky cards and Practice test shortcuts open a panel where you see what is included, choose settings and start right away. The radar chart shows how much you know in each topic of the course.",
  homeRadar:
    "Click a topic in the chart or in the list next to it to open it. There you study only that topic: scheduled, as tricky cards, freely or as a practice test. Green means done: Scheduled study turns green when today's scheduled cards in the topic are done, and Tricky cards when there are no tricky cards left.",
  statsBody:
    "My stats in the menu gathers your own study statistics in one place. It is based only on your own reviews and is visible only to you.",
  statsLink: "Open My stats",
  accountBody:
    "Under Account you change your name and password, download everything we hold about you, and reset progress or delete the account. Kuggfri only sends emails you ask for yourself, such as a sign-in link or a new password.",
  accountLink: "Account and settings",
  accountLinkMeta: "Name, password, your data",
  privacyLink: "Privacy policy",
  privacyLinkMeta: "What data is stored and why",
  faq: [
    {
      q: "Why did the card come back today already?",
      a: "If you rate a card 1 or 2, it goes to the end of the queue and comes back in the same session. New cards and cards you just missed have short intervals the first few times; the intervals grow as you learn the card.",
    },
    {
      q: "What happens if I miss a day?",
      a: "Nothing is lost. The cards wait until you come back, so your next session is a little longer. Your streak is protected by a freeze if you have one left.",
    },
    {
      q: "Can I change how many new cards I get per day?",
      a: "Yes. Go to Account and choose 10, 20 or 40 under Study pace. Due cards are always included. As the exam approaches, the daily goal may be raised in catch-up mode, and it will say so clearly.",
    },
    {
      q: "Does a practice test or free review affect the schedule?",
      a: "Yes. Every rating counts, in all modes: free review, random run-through, tricky cards and practice tests update the card's schedule just like scheduled review. If you review a card before it is due, the interval grows a little less, and reviewing it several times on the same day doesn't give a longer interval.",
    },
    {
      q: "Today's session is done but I want to study more. Can I?",
      a: "Yes, always. Choose Keep studying on the course page or in the summary after the session. You get 20 cards at a time: first those soon due for review, then new cards beyond the daily goal. Carry on as long as you like; everything counts towards the schedule.",
    },
    {
      q: "What do “Learned cards” and “Knowledge” mean?",
      a: "Learned cards are cards whose latest rating is 5. Knowledge (“Known now” when you open a topic) is the schedule's estimate of how large a share of the cards you remember right now.",
    },
    {
      q: "Found an error on a card?",
      a: "Tap the flag below the rating buttons and describe what is wrong. The report goes to the course examiner. If you want a reply, you can leave your email, but it is optional.",
    },
    {
      q: "Can I start over?",
      a: "Yes. Under Account you reset a course, just the schedule or everything. If you reset only the schedule, the cards become new again but your ratings are kept. It cannot be undone.",
    },
  ],
  moreBody:
    "For a single card, use the flag during the session. Questions about the course content go to the examiner, everything else to the person who runs Kuggfri.",
  /** The link block on the About page. */
  fromAbout: "How to use Kuggfri",
  fromAboutMeta: "Getting started, the modes, the rating scale and common questions.",
  keysTo: "to",
};
