/** Passet på engelska: korten, uppgiftstyperna, automaträttade frågor, sammanfattningen, felrapporter, snabbpassen och duggan. Samma nycklar som lib/i18n/sv/study.ts. */
import type { Dict } from "@/lib/i18n/types";

export const study: Dict["study"] = {
  pageTitle: (deck: string) => `Study ${deck}`,
  front: "Front",
  back: "Back",
  flip: "Flip card",
  showHint: "Show hint",
  hint: "Hint",
  rateLabel: "How well did you know this?",
  rate: {
    1: "Not at all",
    2: "Almost",
    3: "Partly",
    4: "Good",
    5: "Spot on",
  } as Record<1 | 2 | 3 | 4 | 5, string>,
  finalReviewBanner: (days: number) =>
    days === 0
      ? "The exam is today: final review of all cards, weakest first."
      : days === 1
        ? "The exam is tomorrow: final review of all cards, weakest first."
        : `Exam in ${days} days: final review of all cards, weakest first.`,
  catchUpBanner: (perDay: number) =>
    `To get through every card before the exam, you'll get ${perDay === 1 ? "1 new card" : `${perDay} new cards`} a day for now.`,
  extraBanner: "Keep studying: first cards due for review soon, then new cards. It all counts towards your schedule.",
  previous: "Previous",
  next: "Next",
  skip: "Skip",
  remaining: (n: number) => (n === 1 ? "1 card left" : `${n} cards left`),
  position: (i: number, total: number) => `Card ${i} of ${total}`,
  cardAnnounce: (i: number, total: number) => `Card ${i} of ${total}. Showing the front.`,
  flippedAnnounce: "Showing the back.",
  ratedAnnounce: (r: number) => `Rated ${r} out of 5.`,
  stamp: (r: number) => `${r}`,
  empty: "There are no cards to show in this mode right now.",
  emptyFsrs: "No cards are due right now. If you want to carry on, choose Keep studying on the course page. That counts too.",
  emptyTricky: "There are no tricky cards in your selection. Nice work.",
  backToDeck: "Back to the course",
  loading: "Loading…",
  saveError: "Couldn't save your rating. Check your connection.",
  queued: (n: number) =>
    n === 1
      ? "1 rating is waiting for a connection and will be sent automatically."
      : `${n} ratings are waiting for a connection and will be sent automatically.`,
  examProgress: (i: number, total: number) => `Question ${i} of ${total}`,
};

/** Uppgiftstyperna: namnet i admin (label), uppmaningen på kortet (instruction) och beskrivningen. */
export const cardKind: Dict["cardKind"] = {
  label: {
    sjalvskattning: "Self-assessment",
    begrepp: "Concept",
    "sant-falskt": "True/False",
    alternativ: "Multiple choice",
  } as Record<"sjalvskattning" | "begrepp" | "sant-falskt" | "alternativ", string>,
  instruction: {
    sjalvskattning: "Self-assessment",
    begrepp: "Explain the concept",
    "sant-falskt": "True or false",
    alternativ: "Choose the correct answer",
  } as Record<"sjalvskattning" | "begrepp" | "sant-falskt" | "alternativ", string>,
  instructionMulti: "Choose all correct answers",
  description: {
    sjalvskattning: "Question and answer. You flip the card and rate how well you knew it.",
    begrepp: "A concept to explain. You flip the card and rate yourself.",
    "sant-falskt": "A statement that is either true or false. Graded automatically.",
    alternativ: "Choose the correct answer from the options, as on the exam. One or more may be correct. Graded automatically.",
  } as Record<"sjalvskattning" | "begrepp" | "sant-falskt" | "alternativ", string>,
  issues: {
    noOptions: (label: string) => `The type ${label} has no answer options.`,
    trueFalseMissing: "The True/False card has no correct answer.",
    tooFewOptions: "The multiple-choice question needs at least two options.",
    trueFalseShape: "The True/False card must have exactly the options True and False.",
    noneCorrect: "At least one option must be correct.",
    emptyOption: "An option is empty.",
    duplicate: (text: string) => `The option “${text}” appears twice.`,
    emptyQuestion: "The question is empty.",
    emptyAnswer: "The answer is empty.",
    emptyExplanation: "The explanation is empty.",
  },
};

/** Automaträttade uppgiftstyper (Sant/Falskt, Alternativ) i passet. */
export const quiz: Dict["quiz"] = {
  pickOne: "Choose an option",
  pickMany: (n: number) => (n === 1 ? "Choose 1 option" : `Choose ${n} options`),
  submit: "Submit",
  continue: "Continue",
  correct: "Correct",
  wrong: "Not quite",
  correctDetail: (rating: number) =>
    rating >= 5
      ? "Correct three times in a row. You've nailed this one."
      : rating === 4
        ? "Correct again. Once more and it sticks."
        : "Correct. The question will come back to reinforce it.",
  wrongDetail: "The question will come back soon, so you get to practise it again.",
  chosenWrong: "Your answer",
  rightAnswer: "Correct answer",
  missed: "Missed correct option",
  explanation: "Explanation",
  answeredAnnounce: (correct: boolean) => (correct ? "Correct answer." : "Wrong answer. The correct answer is marked."),
  keyboardHelp: "1–9 selects, Enter submits and continues, → skips",
  optionLabel: (i: number) => String.fromCharCode(65 + i),
};

export const summary: Dict["summary"] = {
  title: "Session complete",
  examTitle: "Practice test complete",
  examScore: (ok: number, total: number) => `You knew ${ok} of ${total} cards well or instantly.`,
  examNote: "Your answers count towards the schedule, just as in the other modes. Whatever you struggled with will come back soon.",
  doneTitle: "Done for today",
  doneBody: "Today's cards are reviewed and the schedule has the rest covered. If you still have energy, you can keep studying.",
  extraTitle: "Nice, extra session done",
  extraBody: "Everything you just studied counts towards the schedule and makes your next sessions easier.",
  extraHeading: "Keep studying",
  extraOffer: (n: number) =>
    `${n === 1 ? "1 more card" : `${n} more cards`}: first those due for review soon, then new cards beyond your daily goal. Every rating counts towards the schedule, so extra study is never wasted.`,
  extraButton: "Keep studying",
  tileToday: "Reviews today",
  tileTodaySub: (n: number) => (n === 1 ? "1 in this session" : `${n} in this session`),
  tileStreak: "Day streak",
  tileKnown: "Cards you know now",
  tileKnownHelp: "Estimated from the schedule: the sum of the probabilities that you remember each card right now.",
  freezesLeft: (n: number) => (n === 1 ? "1 freeze left" : `${n} freezes left`),
  freezeUsed: "A streak freeze covered a missed day.",
  continuePass: (n: number) => (n === 1 ? "Study 1 more card" : `Study ${n} more cards`),
  continueNew: (n: number) => (n === 1 ? "Add 1 more new card" : `Add ${n} more new cards`),
  continueHelp: "Beyond your daily goal. Good if you have time to spare, but not necessary.",
  reviewed: (n: number) => (n === 1 ? "1 card reviewed" : `${n} cards reviewed`),
  distribution: "Rating distribution",
  needsWork: "Needs the most work",
  colQuestion: "Question",
  colRating: "Rating",
  needsWorkEmpty: "No cards got a low rating.",
  nextDue: "Next scheduled review",
  nextDueNone: "No cards are scheduled yet.",
  nextDueCount: (n: number, when: string) => (n === 1 ? `1 card ${when}.` : `${n} cards ${when}.`),
  freeModeNote: "Free review counts towards the schedule, just like scheduled review.",
  randomModeNote: "Random run-through counts towards the schedule, just like scheduled review.",
  trickyModeNote: "Your ratings count towards the schedule. Cards you now know no longer count as tricky.",
  backToDeck: "Back to the course",
  home: "Home page",
  again: "Another session",
  againExam: "New test",
  tileKnownSub: (total: number) => `of ${total}`,
};

export const session: Dict["session"] = {
  toolbar: "Session tools",
  info: "How it works",
  soundOn: "Turn sound off",
  soundOff: "Turn sound on",
  star: "Star this card",
  unstar: "Remove star",
  report: "Report an error on this card",
  helpTitle: "How to study in Kuggfri",
  helpFlipTitle: "Flip the card",
  helpFlip: "Try to answer in your head first. Then flip the card by clicking it, pressing Flip card or the space bar.",
  helpRateTitle: "Rate how well you knew the answer",
  helpRate: "Rate honestly right after you flip the card. Your rating decides when the card comes back.",
  rateMeaning: {
    1: "You didn't know the answer. The card comes back soon.",
    2: "Close, but not right. The card comes back soon.",
    3: "Right, but it took effort. The card comes back fairly soon.",
    4: "Right without much trouble.",
    5: "Instant and confident. The card waits longest before it comes back.",
  } as Record<1 | 2 | 3 | 4 | 5, string>,
  helpKeysTitle: "Keyboard",
  keys: [
    ["Space", "Flip the card"],
    ["1–5", "Rate the card"],
    ["← →", "Previous and next card"],
    ["H", "Show hint"],
    ["1–9", "Answer a multiple-choice question"],
    ["Enter", "Submit and move on"],
  ] as ReadonlyArray<readonly [string, string]>,
  helpButtonsTitle: "The buttons",
  helpStar: "The star marks cards you want to come back to. Choose the Starred mode on the course page to study just those.",
  helpSound: "The speaker turns the sound on and off when you rate a card.",
  helpReport: "The flag sends an error report about the card to the course examiner.",
  helpSwipe: "On your phone you can also swipe: left rates 1, right rates 5.",
  helpSchedule: "Read more about the schedule, the modes and the practice test under Help.",
  starredTitle: "Your starred cards",
  starredShow: (n: number) => (n === 1 ? "Show your starred card" : `Show your ${n} starred cards`),
  starredEmpty: "You haven't starred any cards yet. Tap the star in the top right of a card during a session.",
  starredHelp: "Tap the star to remove a card from the list.",
};

export const report: Dict["report"] = {
  title: "Report an error on this card",
  help: "Describe what is wrong or unclear. The report goes to the course examiner.",
  message: "What's wrong?",
  contact: "Email if you'd like a reply (optional)",
  send: "Send report",
  sent: "Thanks! Your report has been sent.",
  tooShort: "Write a few words about what's wrong.",
  tooLong: "The report is too long (max 1,000 characters).",
  rateLimited: "Too many reports in a short time. Try again in a moment.",
};

// Dialogerna bakom genvägarna Kluriga kort och Dugga på hemsidan.
export const quick: Dict["quick"] = {
  trickyLead: "Cards you rated 1–2, and cards you haven't seen yet. Weakest first. Your ratings count towards the schedule.",
  weak: "Rated 1–2",
  unseen: "Not seen yet",
  time: "Time",
  minutes: (n: number) => `${n} min`,
  about: "roughly",
  cardsOf: (n: number, total: number) => `${n} of ${total}`,
  areas: "Topics",
  areasHelp: "Untick anything you don't want to do now.",
  areaCount: (weak: number, unseen: number) =>
    weak + unseen === 0
      ? "No tricky cards"
      : [weak > 0 ? `${weak} rated 1–2` : "", unseen > 0 ? `${unseen} unseen` : ""].filter(Boolean).join(", "),
  selectAll: "Select all",
  trickyStart: "Start tricky cards",
  startMeta: (n: number, minutes: number) => `${n === 1 ? "1 card" : `${n} cards`}, about ${minutes} min`,
  trickyNone: "Choose at least one topic with tricky cards.",
  duggaLead: "Random questions from the whole course, one at a time with no going back. You rate yourself as usual, and your answers count towards the schedule.",
  duggaStartMeta: (n: number, minutes: number, hints: boolean) =>
    `${n === 1 ? "1 question" : `${n} questions`}, about ${minutes} min, ${hints ? "with hints" : "no hints"}`,
  onCoursePage: "More on the course page",
  aboutMinutes: (n: number) => `about ${n} min`,
};

/** Inställningar under Ditt pass på kurssidan: olika för varje läge, styr passet. */
export const passSettings: Dict["passSettings"] = {
  size: "Number of cards",
  sizeToday: (n: number) => `Today's (${n})`,
  sizeAll: (n: number) => `All (${n})`,
  sizeTodayHelp: "Due cards come first. If you take fewer, the rest wait for your next session.",
  newCards: "New cards today",
  newCardsHelp: "Include today's new cards. Off: reviews only.",
  byArea: "One topic at a time",
  byAreaHelp: "Go through the cards topic by topic instead of mixed.",
  hardestFirst: "Hardest first",
  hardestFirstHelp: "Cards you rated 1 come first. Off: random order.",
  unseen: "Include unseen cards",
  unseenHelp: "Cards you've never rated count as tricky. Off: only cards you rated 1 or 2.",
  order: "Order",
  orderHelp: "Weakest first, in course order or random.",
  orderStandard: "Weakest",
  orderCourse: "Course order",
  orderRandom: "Random",
  kinds: "Question types",
  kindsHelp: "You rate flip cards yourself. Auto-graded cards (true or false and multiple choice) are graded right away.",
  kindsAll: "All",
  kindsFlip: "Flip cards",
  kindsQuiz: "Auto-graded",
  followAreas: "Selected topics only",
  followAreasHelp: "Off: the whole course, regardless of which topics are ticked.",
};

export const dugga: Dict["dugga"] = {
  settingsTitle: "Settings",
  questions: "Number of questions",
  hints: "Allow hints",
  hintsHelp: "Show the hint when the card has one.",
  timer: "Timer",
  timerHelp: "Show how long the practice test takes.",
  start: "Start practice test",
  badge: "Practice test",
  elapsed: "Time",
  duration: (text: string) => `Time: ${text}`,
  homeMeta: "Choose length and rules",
  areaMeta: "Just this topic, your rules",
};
