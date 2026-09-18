# The flashcard / spaced-repetition category, September 2026

Researchunderlag till docs/OMVARLDSANALYS.md. Sammanställt 18 september 2026 av Claude via webbsökning (25 sökningar, ~30 hämtningar). På engelska. Caveats: quizlet.com och brainscape.zendesk.com svarade 403, Reddit var onåbart; Quizlet/Brainscape-detaljer kommer från deras bloggar, Wikipedia, hjälpcenter-sammanfattningar och tredjepartsrecensioner.

## Executive summary

The category has split into three camps. **Quizlet** owns the mainstream (60M+ MAU at last disclosure) but has spent 2022–2026 walking its active-learning modes behind a $35.99/yr paywall, and its flagship AI tutor Q-Chat was quietly retired in June 2025. **Anki** owns the power-learner segment (94% of surveyed first-year med students at UCF use it) and, since FSRS became the default scheduler in 25.07, has the strongest algorithm and the deepest stats, at the cost of an onboarding cliff. A third wave — **Knowt, Noji, RemNote, Vaia, Gizmo, Mochi** — competes on "free Quizlet modes + AI generation + FSRS", and most of them expose "desired retention" as a user-facing setting. The research base (testing effect, spacing, Dunlosky 2013) is unambiguous; the open product problems are honest ratings, backlog anxiety, and stats that motivate rather than confuse.

## 1. Study modes beyond flip-cards

**Quizlet.** Modes: Flashcards, Learn (adaptive multiple choice → written), Test (generated exam), Match (timed drag-match), Blocks (Tetris-style single-player game), Blast (fast-paced class review, "if you only have five minutes left in class"), Quizlet Live (team matching, 2016), Checkpoint (teacher formative poll, "does not have an individual record of each student"). AI layer announced Aug 2023: Magic Notes (paste/upload notes → flashcards, outlines, practice tests), Quick Summary, Brain Beats (study songs), Q-Chat (OpenAI-based tutor with "Teach Me, Quiz Me, Apply my Knowledge, Practice with Sentences"). Q-Chat "is no longer available" as of June 2025. Learn is Plus-only since 2022.

**Anki.** Note types (Basic, Basic-and-reversed, Cloze, Image Occlusion built in since 23.10; IO gained "mask colour fill" and rotation in 25.07), nested cloze to 10 levels, `{{type:}}` fields for typed answers (25.07 added `{{type:nc:…}}` to ignore combining characters), custom study, filtered decks, MathJax, and a JS-capable card template system. The reviewer is deliberately just "show answer → Again/Hard/Good/Easy". AnkiDroid 2.23 (Dec 2025) shipped a "Completely redesigned study screen" and bundles Anki 25.09's scheduler; 2.24 (May 2026) added bulk note-type change and a redesigned filtered-deck screen.

**RemNote.** Notes-first: cards are lines in an outliner (`>>` concept/descriptor, `{{cloze}}`, lists, "clusters", image occlusion), PDF/slide annotation with "key summaries at the bottom of every PDF page", an Exam Scheduler, and AI quizzes/tutor. Own blog admits "a steep learning curve since it has a lot of features."

**Mochi.** Markdown-first; `---` splits sides, cards may have more than two sides; "Hidden text" cloze, templates, `<ai/>` dynamic fields (GPT), Azure TTS fields, Anki `.apkg` import with template conversion. Review modes: due today, reverse review, "Cramming", archive. FSRS shipped as beta preview in v1.19.0 (16 Jun 2025).

**Brainscape.** Single mode ("Smart Study") plus streaks/leaderboards; "limited card type variety" is its known weakness. **Knowt.** Free clones of Quizlet's whole suite: Learn (MC, T/F, fill-in, flashcard), Practice test, Match, Spaced repetition; imports Quizlet sets "completely free in seconds"; claims 8.4M users and "50% of all AP students." **SuperMemo** remains the reference point (Learn/Repeat modes, incremental reading) but is Windows-centric, 35.99 PLN/mo.

## 2. The rating UX debate

Three schools exist:

- **Anki/FSRS 4-button.** The manual: Again = "incorrect or couldn't recall"; Hard = "correct, but you had doubts or it took a long time"; Good = "correct, but took some mental effort" and should be "the most commonly used button"; Easy = "no mental effort." Shortcuts 1/2/3/4, with Space/Enter = Good. The manual itself blesses a 2-button reduction: "Use Again for incorrect answers and use Good for correct answers."
- **Pass/fail.** Pre-FSRS forum consensus was literally "use 2 answer buttons only"; the Pass/Fail add-on maps Pass→Good, Fail→Again and is FSRS-compatible. Arguments: "decision paralysis when reviewing" and the SM-2 pathology that Hard/Again-only decay ease to 130%.
- **1–5 confidence (Brainscape, SuperMemo 0–5).** Brainscape's "confidence-based repetition": 1 = "not at all", 5 = "totally confident"; the pitch is that it "trains your metacognition" to separate "the warm glow of familiarity from the colder, more honest signal."

What the FSRS community says about granularity: FSRS treats Hard as a **pass** — "FSRS assumes you have recalled the information correctly (though with hesitation)" and "if you press Hard when you have failed to recall the information, the intervals will be unreasonably high." Grade "based only on how easy it was to answer the card, not how long you want to wait." Misuse was common enough that FSRS Helper ships a "Remedy Hard Misuse" tool converting historical Hard→Again. On whether 4 buttons help: FSRS maintainer Expertium told a user with 60,000 Again/Good reviews that a third button "gives you a bit more control over your interval lengths, but it's not clear at all whether there will be any tangible benefit." Anki's "true retention" table counts Hard/Good/Easy as pass, Again as fail, first review per day only. RemNote's four buttons rename the same scale ("Forgot / Partially recalled / Recalled with effort / Easily recalled"); Mochi uses "forget / remember" with next-due-date tooltips.

**Design takeaway:** binary is honest by construction; if you offer Hard, label it as a pass and show the resulting interval.

**Retention target.** FSRS "desired retention" default 90%; documented range 70–97% (Anki allows up to 99%), with "above 90% the workload increases very quickly." Anki 25.09 (Sep 2025) added per-deck desired retention and "desired retention info graphs"; 25.07 removed "Compute minimum recommended retention" and replaced Evaluate with a "health check". RemNote exposes the same 70–97%/90% guidance in scheduler settings; Mochi added a "target retention rate" field (Oct 2025, capped at 1). Quizlet, Brainscape and Knowt expose no retention setting at all.

## 3. Session design and the backlog problem

Anki's deck list shows three counts (new / learning / review). Daily caps: "new cards/day" and "maximum reviews/day"; when the review cap is hit, "a message will appear in the congratulations screen, suggesting you consider increasing the limit." The costs of that design are documented: in the UCF survey **82.1% found Anki overwhelming, 67.9% felt anxious**, 52.5% skipped exercise and 34.5% lost sleep to it. A forum case: rescheduling created "2,500 pending cards" on top of a "500–700 daily workload."

Backlog mitigations now native in Anki: **fuzz** (random interval jitter, also applied to SM-2 lapses since 24.11); **load balancing** ("Within your fuzz range, Anki will now try to pick days that have fewer reviews waiting"); **Easy Days** (avoid weekdays; "Apply easy days now" in FSRS Helper to avoid a spike); **sort by descending retrievability** ("simulations have shown this is a better choice when you have a backlog"); FSRS Helper's Postpone/Advance/Flatten ("if the number of future due cards exceeds the limit, the cards are postponed"). Moderator advice: reschedule only `prop:due<=7` weekly, or isolate the backlog in a filtered deck.

Alternatives cap sessions instead: Noji free tier "caps you at 50 cards per day"; Brainscape and Gizmo lean on streaks; RemNote's Exam Scheduler "computes a daily goal … from the practice you have coming up this week and the total practice remaining", and when behind "proposes temporary increased daily goals rather than silently rearranging cards." Quizlet Learn works in rounds with a test-date goal — no persistent due count, hence no dread, hence no long-term retention either.

## 4. Progress and stats

Anki's Statistics screen: Today, Future Due (with "daily load" = Σ1/Iₙ), Calendar heatmap, Reviews, Card Counts (new/learning/young/mature/suspended), Review Intervals, Card Ease/Difficulty/Stability/Retrievability, Hourly Breakdown, Answer Buttons, True Retention ("mature if interval ≥21 days"), plus "Estimated total knowledge is the total number of cards you are likely to currently remember." 25.07 swapped means for medians. Community add-ons (Review Heatmap, Interactive Heatmap with retention-colored tiles, "New Card Counter / Forecast Graphs") remain the most-installed, which tells you what users actually want: the GitHub-style streak grid and a "how many more today" number.

Quizlet reports a per-set "mastery" percentage and Learn-round progress; Brainscape shows per-deck mastery bars derived from confidence ratings; RemNote shows daily goals and a Knowledge Stats panel; Mochi is deliberately sparse.

What confuses: Andy Matuschak's note — "Your expected accuracy rate across your entire collection may be 95+%, but your accuracy rate in a given session is likely to be much lower", because you only see the cards you're weakest on. Kornell 2009: spacing beat massing for 90% of participants, yet 72% believed massing worked better. Design implication: show collection-level retention (not session accuracy) and "cards you currently remember", and keep a steady trickle of new cards so sessions don't feel like pure failure.

## 5. Content creation and sharing

- **AI generation** is table stakes: Quizlet Magic Notes (Plus), RemNote (PDF/video/notes → cards, quizzes, "Pro+AI $18/mo"), Knowt (lecture recording, PDF, YouTube, "Kai" tutor/podcast), Gizmo (PDF/PPT/web/YouTube, streak-based), Noji, StudyGlen, Mochi's `<ai/>` fields.
- **Community decks:** AnkiWeb shared decks; the **AnKing** Step deck (v12, 30,000+ cards) distributed via **AnkiHub** (subscription; collaborative tag-based updates per curriculum). 97.6% of UCF first-years use pre-made cards; 68.3% of 560 students across 102 US schools use Anki. Quizlet's 500M user sets are its moat but "user-generated content isn't always high quality or error free." Memrise (2025) buried community courses in a spin-off "Memrise Decks" site — a cautionary tale.
- **Teacher tooling:** Quizlet "Class Progress" (Plus for teachers): which students "have started or completed", highest scores on Test/Match/Gravity, class-level "most to least missed terms." Live/Blast/Checkpoint for in-class use. Anki has none; RemNote/Knowt have basic sharing.

## 6. Visual and interaction design

Conventions: tap/space to flip, keyboard 1–4 (Anki), swipe on mobile (Quizlet's flashcard mode; AnkiDroid gesture zones; Noji). HN critique: Anki historically "didn't have thumbs up/down icons" so users memorized number keys. LaTeX: Anki (MathJax, improved caching 25.07), RemNote, Mochi (KaTeX) yes; Quizlet limited; Brainscape no. Images: Anki IO, RemNote IO; Quizlet custom images paywalled since 2023. Dark mode is universal (Mochi on/off/auto since 2020; AnkiDroid 2.24 dark-mode icons). Density: Mochi minimal, Anki dense/configurable, Quizlet spacious and ad-interrupted.

## 7. Business anti-patterns to avoid

1. **Paywalling the learning loop.** Quizlet: Learn (2022) → custom images, offline, ad-free (2023) → AI explanations (2024). Trustpilot 1.4/5 across 600+ reviews, most common word "paywall." Third-party summary: "Quizlet Free in 2026 is a card flipper with ads." Knowt built an 8M-user business on the gap.
2. **Ads inside sessions.** "Full-screen video ads between study sessions" on Quizlet free.
3. **AI hallucinations and retreat.** Q-Chat discontinued June 2025; hallucinated cards are the standing complaint against every generator.
4. **Data hostage.** Quizlet export paywalled; Noji exports "CSV text only — no .apkg", suffered a 10-day outage in May 2025 and served a Rick Roll to users trying to export; forced rebrand from "Anki Pro" after trademark pressure (July 2025).
5. **Privacy.** Common Sense's report: Quizlet and ad partners "may track and serve advertisements… to provide more relevant ads."
6. **Onboarding cliff.** Anki's default-off FSRS was fixed (default in 25.07), but deck options still expose dozens of fields; RemNote acknowledges its own "steep learning curve."
7. **Feature bloat vs. lock-in:** Mochi shows the opposite pole ($5/mo only for sync, local-first).

## 8. Power learners vs. mainstream, and the evidence

Med students consider essential: FSRS with ~90% retention, pre-made tagged decks (AnKing/AnkiHub), cloze + image occlusion, suspend/unsuspend by tag, heatmap/streak, and mobile sync. Language learners add audio/TTS, sentence cards and reverse cards. Mainstream students use Quizlet the night before ("cramming"): Dunlosky notes "84 percent of the students studied by rereading."

Evidence: Roediger & Karpicke 2006 — repeated testing beat rereading one week later, 61% vs 40%. Karpicke & Blunt 2011 (Science) — retrieval beat concept mapping even on inference questions. Cepeda et al. 2006 — 839 assessments/317 experiments; optimal gap ≈10–20% of the retention interval. Kornell 2009 — one big flashcard stack beats four small ones. Dunlosky et al. 2013 — practice testing and distributed practice rated **high utility**; interleaving/elaboration moderate; rereading, highlighting, summarization low. Medicine: Deng et al. 2015 (retrieval practice predicts licensing exam score), Lu et al. 2021, and the 2025 Cureus survey (Nour & Harris, n=89): 87.8% believe Anki drove module success, r=0.621 between usage share and perceived success — alongside the burnout numbers above.

## Sources

- https://docs.ankiweb.net/studying.html
- https://docs.ankiweb.net/deck-options.html
- https://docs.ankiweb.net/stats.html
- https://github.com/ankitects/anki/releases/tag/24.11
- https://github.com/ankitects/anki/releases/tag/25.07
- https://github.com/ankitects/anki/releases/tag/25.09
- https://ankidroid.org/changelog.html
- https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md
- https://github.com/open-spaced-repetition/awesome-fsrs/wiki/ABC-of-FSRS
- https://github.com/open-spaced-repetition/fsrs4anki-helper
- https://forums.ankiweb.net/t/changing-easy-days-without-getting-a-backlog/65363
- https://forums.ankiweb.net/t/switching-from-2-answer-button-system-to-3-or-4/51664
- https://news.ycombinator.com/item?id=44020591
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12662189/
- https://www.aft.org/ae/fall2013/dunlosky
- https://pubmed.ncbi.nlm.nih.gov/26173288/
- https://pubmed.ncbi.nlm.nih.gov/16507066/
- https://pubmed.ncbi.nlm.nih.gov/21252317/
- https://pubmed.ncbi.nlm.nih.gov/16719566/
- https://onlinelibrary.wiley.com/doi/abs/10.1002/acp.1537
- https://notes.andymatuschak.org/z7eDbmw9aUV7FCYYVstUQz4
- https://quizlet.com/blog/ai-study-era
- https://quizlet.com/blog/meet-q-chat
- https://quizgecko.com/blog/best-q-chat-alternative
- https://en.wikipedia.org/wiki/Quizlet
- https://help.quizlet.com/hc/en-us/articles/360030512432-Using-Class-Progress
- https://wordsonrepeat.com/blog/quizlet-paywall-2026-free-alternatives
- https://fluentflash.com/compare/is-quizlet-free
- https://privacy.commonsense.org/privacy-report/quizlet
- https://knowt.com/
- https://www.remnote.com/blog/best-anki-alternatives
- https://help.remnote.com/en/articles/9337171-understanding-spaced-repetition
- https://help.remnote.com/en/articles/9102040-understanding-the-exam-scheduler
- https://mochi.cards/docs/
- https://mochi.cards/changelog/
- https://www.brainscape.com/academy/confidence-based-repetition-definition/
- https://supermemo.guru/wiki/Algorithm_SM-18
- https://noji.io/ankipro-vs-anki/
- https://kachika.app/en/blog/top-anki-alternatives-2026/
- https://www.theanking.com/med-student
- https://community.ankihub.net/t/looking-for-best-anki-decks-for-medical-students/408019
- https://techcrunch.com/2023/09/21/ai-startup-gizmo-funding-gamified-quizzes-flashcards-make-learning-fun/
- https://www.vaia.com/en-us/magazine/ultimate-guide-to-flashcard-apps/
- https://ankiweb.net/shared/info/1771074083
- https://ankiweb.net/shared/info/1782362167
