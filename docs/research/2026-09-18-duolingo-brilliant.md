# Duolingo & Brilliant: Why People Come Back (2026)

Researchunderlag till docs/OMVARLDSANALYS.md. Sammanställt 18 september 2026 av Claude via webbsökning. På engelska.

## 1. Core learning loop

**Duolingo.** A lesson is ~10–15 exercises, 3–5 minutes, one tap from the home screen (Growth.design calls this the "Hick's Law" single-CTA home). Exercise types: translate (tap-tokens or typing), listen-and-type, speak, match pairs, fill-the-blank, plus Stories, Adventures, Radio and AI "Video Call"/Roleplay for Max subscribers. Every answer gets immediate green/red feedback with a character reaction; wrong answers are re-queued at the end of the same lesson. Difficulty adaptation and sequencing are run by "Birdbrain" (internal ML, v2), which predicts per-exercise probability of a correct answer and picks items near the learner's edge; the spacing layer is Half-Life Regression (HLR), Duolingo's published model that estimates per-word forgetting half-life from a 13M-trace dataset. Duolingo reported HLR gave +9.5% retention for practice sessions, +1.7% for lessons and +12% overall activity versus their previous scheduler; the paper claims ~45% lower recall-prediction error than Leitner. Mistakes are collected in a free "Practice" tab (barbell icon) with Mistakes review, Words, Listening and Speaking drills; the article "Guide to Duolingo Practice Hub" confirms it's now free for everyone (Max adds Video Call/Roleplay replays).

**Brilliant.** A lesson is 5–10 interactive problems, ~15 minutes (Upskillwise). Each problem asks you to *do* something first — drag a weight on a balance scale for algebra, slide a parameter, arrange tiles — and only then explains. Wrong answers get an explanation that is itself interactive ("interactive elements allowing active exploration rather than passive reading", screensdesign teardown), and a "Koji" AI tutor "walks you through the thinking step by step, without giving the answer" (help center). Brilliant has no published spaced-repetition model; adaptation is mostly the initial placement and a "Practice" mode at the end of lessons. There is no offline mode. Free tier: two lessons a day, forced sequential order, ads.

## 2. Retention mechanics

**Duolingo (documented numbers):**
- **Streak** — the foundation. 7-day-streak users were "nearly tripled to over 50% of DAU" after the streak optimization program (Jorge Mazal, Lenny's Newsletter); ~32M DAU carry a 7+ day streak (Deconstructor of Fun). Users at a 7-day streak are 2.4x more likely to return next day (Sensor Tower). Over 600 experiments on the streak alone. A single phoenix milestone animation gave **+1.7% D7 retention**. Streak Society tiers at 7/30/100/365 days give app icons, chests, extra freezes and "VIP" streak display in leaderboards. "Perfect streak" (no freezes used) is a pure status halo. Milestone share cards in Instagram/Twitter aspect ratios drove 5–10x more organic sharing (~6M shares/day).
- **Streak freeze** — max 2 for free users, up to 5 for long streaks; applied silently; Super gets auto-refill. A "streak repair" backstop lets you re-earn a broken streak within a short window. Mazal's own lesson: the former Head of Growth quit after losing an 80-day streak — freezes exist to cap the "quit" trigger.
- **Streak wager** — 50 gems on a 7-day streak, deployed right after the "welcome back" 100-gem reward: **+14% D7 retention** (Growth.design).
- **Leagues** — 30 users, weekly, Bronze→Diamond, opt-in by simply earning XP. Added **+17% learning time** (Mazal); iOS launch raised both lesson starts and completions (Duolingo blog, "Improving Duolingo one experiment at a time"). A related test — a Plus promo that raised signups but lowered retention — was killed.
- **Quests** — 3 Daily Quests refreshing daily (chests with gems/15-min XP boost); Friends Quests pair you Tuesday 1pm EST for 5 days (100 gems + 30-min 2x XP); monthly badge for 25–50 quest points. Duolingo claims learners who follow friends are **5.6x** more likely to finish a course; Friend Streaks (up to 5) show +22% daily lesson completion.
- **Hearts → Energy** — 2025 switch: 25 energy/day, −1 per *exercise* regardless of correctness, +1–5 for correct-answer runs, 750 gems for a refill, unlimited for Super/Max. Management says energy "rewards correct streaks instead of penalizing mistakes" and lifted DAU and conversion; users experience it as a harder paywall (see §7).
- **Notifications** — a contextual bandit selects from pre-written templates per user/language/streak state, trained on 200M reminders in 34 days; it explicitly demotes recently-seen copy ("novelty effect"). The famous "passive-aggressive" template — "Hi, this is Duo. These reminders don't seem to be working. We're going to stop sending them for now." — is, per Head of Product Cem Kansu, one of their most successful. Streak-saver pushes fire late evening before midnight. Mazal's rule: protect the channel; Groupon-style aggressive testing burned email.
- **Widget** — hackathon project, iOS July 2022, Android March 2023. Shows only streak + "done today?"; Duo's mood degrades toward midnight; 25 "unhinged Duo" variants. 50% of widget installers have a ≥6-month streak; Sensor Tower cites +60% commitment.
- **Streak Revival** (June 2026) — a one-time campaign re-engaged 15M+ lapsed users with above-average retention (Q2 2026 call).

**Brilliant:** the same skeleton at lower intensity. Streak requires 3 problems or a full lesson per day; "Streak Charges" are the freeze equivalent; leagues are 30 learners, 10 element-named tiers (Hydrogen…Einsteinium), reset Monday 03:00 UTC; XP from lessons and practice; an iOS streak widget; daily challenges in the "Today" tab. ustwo's 2023 redesign ("Play Thinking") added a Level Gameboard, a "learning companion" that points to the next lesson, in-lesson celebration flourishes, and "encouragement moments during struggles", explicitly measured on "retention after week one". The streak celebration was Brilliant's first simultaneous iOS/Android/web Rive rollout. No public retention numbers.

## 3. Onboarding

**Duolingo:** language pick → "why are you learning" → daily goal (Casual 5 min … Intense 20 min) → "how much do you know" placement → first lesson → *then* signup. Moving signup behind the first lesson lifted DAU ~20% (widely cited; originated in Duolingo's own A/B tests). Time to first correct answer is under a minute. A returning user gets a deliberately easier "special review lesson" plus 100 gems, then the streak wager.

**Brilliant:** ~30-second flow; instead of a questionnaire it opens with *actual math problems* to place you, then recommends a path and shows a personalized plan with a goal date. Signup comes before the paywall (trial timeline visualization, testimonials, comparison table, native Apple subscription sheet). screensdesign's critique: the recommendation screen never explains *why* that path was chosen. Aha moment is the first manipulable diagram, typically within the first two problems.

## 4. Visual design & motion

**Duolingo:** VP of Design Ryan Sims: "We're not an education company. We're a fun and motivation company." Art style ("shape language" post): rounded vector shapes, "fewest details needed", clear silhouettes with white negative space, exaggerated caricature, bright colours on white — chosen explicitly because "a big hurdle of language learning is getting over the fear of making mistakes." Type: custom **Feather Bold** for chrome/headings; Owl green #58cc02 as primary. A cast (Duo, Lily, Oscar, Eddy, Bea, Junior…) with a world-building team to keep stories consistent; characters animate on correct answers as the reward itself. Animated skill icons hold attention longer than static ones. Sound design: distinct correct/incorrect chimes, lesson-complete fanfare. Accessibility is mixed: VoiceOver works in lessons but the lesson-complete and path screens are hard to navigate; small text and low contrast complaints; there is *no native dark mode* on web — fans use "DuoDark" extensions.

**Brilliant:** a restrained, mathematical aesthetic — tangram loading animations, per-topic colour-coded path nodes, thin-line diagrams. Motion is now Rive across platforms (state machines for streak counts and path nodes; "what you build in Rive is what's in the product"). Sound and haptics accompany interactions (Rive post). The 2026 engineering blog shows the technical priority: a Rust/wgpu canvas renderer, a "rendering contract: seven things a frame never trades", jank profiling, 13,000-element canvases — i.e. the *interactives* are the product, and frame-rate is treated as a learning-quality issue.

## 5. Content format

Duolingo's unit of content is the short, discrete exercise; comprehension is built by volume and interleaving. Brilliant's unit is the manipulable model: balance scales, sliders, vector fields, code cells, with "try to find a solution before learning the procedure" and a why-explanation after each answer. Brilliant's claim that interactive learning is "6x more effective" is marketing, not a cited study.

## 6. Progress visualization

**Duolingo "path"** (Nov 2022) replaced the tree: one linear route of circles; each circle = one old crown level; lessons interleaved across skills; practice and Stories embedded at the right difficulty; a Unit Guidebook per unit; Legendary challenges per unit (no hints, harder items; a unit goes Legendary when >half its levels are). Rationale: learners "questioned whether they were using the app correctly"; interleaving/spacing baked in rather than left to the user's "hover method". Duolingo's 2024 whitepaper says path learners meet expected CEFR outcomes. Sections map to CEFR (Section 3 ≈ A1, Section 4 ≈ A2, Section 6 ≈ B1, Section 8 ≈ B2) and a 0–160 "Duolingo Score" tracks proficiency separately from streak. Launch reception was loudly negative (subreddit cancellation threats), which Duolingo rode out.

**Brilliant:** course maps as branching paths of coloured nodes ("Level Gameboard"), course-level progress bars, a Today tab with daily challenges, and Learning Paths spanning multiple courses.

## 7. Drawbacks and criticism

- **Energy** (2025–26): Android Authority's 700-day user quit because perfect lessons now drain energy by the third lesson; Class Central called it "breaking hearts for energy"; Sam Liberty (game designer) argues it removes the skill→resource link that made hearts legible. No opt-out.
- **Guilt notifications**: Debugger's "Duolingo needs to chill"; the "passive-aggressive" template is celebrated internally and resented publicly.
- **Gamification misuse**: the Learning@Scale 2022 study (9 years of forum data + 15 interviews) documents users farming XP with easy lessons for leagues, "herding", anxiety and time waste — and gives design mitigations (decouple competition from learning metrics, allow opt-out).
- **Path backlash** and repeated removal of features (Duolingo forums, per-skill practice) — users feel A/B-tested on.
- **Efficacy**: Duolingo-authored studies say Basic (A2) completers score like students after four university semesters, and independent CALICO/Foreign Language Annals studies confirm receptive gains — but a 2021 systematic review (Computer Assisted Language Learning) calls the evidence base thin and methodologically weak, mostly measuring motivation not proficiency. Speaking/writing lag.
- **Accessibility gaps** (above).
- **Brilliant**: Trustpilot/Substack complaints of ambiguous or wrong answers where "the only way to pass was to suss out which answer the app wanted", shallow Python explanations, courses disappearing mid-progress, no refunds, auto-renew. A Cedar Sanderson six-month review: "other than the streaks, there isn't really a reason for me to keep at it." An App Store reviewer with ADHD found it "doesn't really game it up enough" compared with Duolingo.

## 8. Published metrics

- DAU 56.5M (Q1 2026, +21% YoY), 58.7M (Q2 2026, +23%); target 100M by end-2028; "current user retention" at all-time high, +~1pt YoY; ~350 changes shipped weekly via "Green Machine". Revenue Q2 2026 $298.5M, 86% subscriptions.
- Growth program 2018–22: DAU 4.5x; CURR +21% (≈40% cut in daily churn); referral only +3% new users; Gardenscapes-style "moves counter" neutral and rolled back.
- Streak: >50% of DAU on 7+ day streak; +1.7% D7 from milestone animation; wager +14% D7; widget users 50% at 6-month streak; leagues +17% learning time; HLR +12% activity.
- Brilliant: 4.7★ / 32k ratings, "10M+ users"; no retention numbers published.

## 9. What transfers to a university STEM flashcard/study platform

**Transfers well**
- **Delayed signup and a sub-60-second first review.** Students evaluating a tool before an exam won't create an account first; let them flip five cards from a public deck, then ask.
- **One-tap "start" and a fixed session size** (Duolingo's 3–5-minute lesson; Brilliant's 5–10 problems). Serious students still fragment study across lectures; a bounded session with an explicit *exit point* ("you're done for today") outperforms an endless queue — Growth.design's point 7.
- **Spaced repetition with a visible model.** HLR's per-item half-life is exactly what a flashcard engine should expose ("this card is due because your recall probability just dropped below 50%"). STEM students respect the mechanism when it's legible; hide it and it feels arbitrary.
- **Mistakes-first review** (Duolingo Practice tab, free) — the most valued feature for exam prep.
- **Brilliant-style "attempt before explanation" and why-explanations.** For engineering courses, a card that asks for a derivation step before revealing it beats recognition-only cards.
- **Path/unit structure mapped to the actual course schedule** (week 1 → week 8 → tenta). The path's insight — "am I using this right?" — is even stronger for a course tool; Legendary-style "no hints" mode maps naturally to exam simulation.
- **Streak with generous freezes and a repair window.** Keep the counter, cap the loss-aversion: 2–5 freezes, silent application, weekend-aware. The widget lesson (streak + done-today only) is cheap to copy.
- **Friend Quests / study-pair accountability** over global leaderboards. Cohort-scoped (same course, same exam date) pairs make sense; random 30-person leagues do not.

**Transfers poorly or is harmful**
- **XP leagues** invite exactly the gamification misuse documented at Learning@Scale: farming easy cards for rank. If ranked at all, rank on *retention* (cards kept stable) not volume, and allow opt-out.
- **Hearts/energy** — punishing errors or throttling practice is the opposite of what an exam-prep tool should do; the 2025 backlash is the cautionary tale.
- **Guilt-copy notifications.** University students already have a deadline; one calm reminder tied to the real schedule ("Signals & Systems exam in 9 days — 42 cards due") beats Duo's desperation. Duolingo's own "we'll stop sending these" opt-down is worth copying literally.
- **Mascot-driven charm** is not a retention lever for adults with an external motivator; Brilliant's restrained aesthetic and per-topic colour coding is the better reference. Do adopt: instant answer feedback, a short celebratory state change on lesson completion (Brilliant's +ustwo flourishes; Duolingo's +1.7% from one animation shows small cues matter), and sound that can be muted.
- **Engagement-as-goal metrics.** Both companies optimise DAU; a course platform should optimise cards retained at exam time and report that to the student — the thing the researchers say Duolingo doesn't do.

## Sources

- https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth
- https://growth.design/case-studies/duolingo-user-retention
- https://blog.duolingo.com/new-duolingo-home-screen-design
- https://blog.duolingo.com/how-we-learn-how-you-learn
- https://research.duolingo.com/papers/settles.acl16.pdf
- https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/
- https://blog.duolingo.com/improving-duolingo-one-experiment-at-a-time
- https://blog.duolingo.com/widget-feature
- https://blog.duolingo.com/friends-quests/
- https://blog.duolingo.com/guide-to-duolingo-practice-hub/
- https://blog.duolingo.com/shape-language-duolingos-art-style/
- https://developer.apple.com/news/?id=jhkvppla
- https://duolingo.deconstructoroffun.com/mechanics/streaks
- https://sensortower.com/blog/duolingo-streak-feature-app-engagement-growth
- https://duoplanet.com/duolingo-energy-system/
- https://www.androidauthority.com/quitting-duolingo-energy-system-3599842/
- https://www.classcentral.com/report/duolingo-breaks-hearts-for-energy/
- https://medium.com/design-bootcamp/how-duolingos-new-energy-system-is-failing-its-users-16738c83117b
- https://debugger.medium.com/duolingo-needs-to-chill-8f1832745ca0
- https://finance.biggo.com/news/US_DUOL_2026-08-05
- https://www.classcentral.com/report/duolingo-q2-2026/
- https://www.investing.com/news/transcripts/earnings-call-transcript-duolingo-beats-q1-2026-earnings-expectations-93CH-4657601
- https://duolingo-papers.s3.amazonaws.com/reports/Duolingo_whitepaper_language_read_listen_write_speak_2024.pdf
- https://www.duolingo.com/efficacy/studies
- https://utppublishing.com/doi/10.1558/cj.26704
- https://onlinelibrary.wiley.com/doi/10.1111/flan.12600
- https://www.tandfonline.com/doi/full/10.1080/09588221.2021.1933540
- https://dl.acm.org/doi/10.1145/3491140.3528274 (arXiv: https://arxiv.org/pdf/2203.16175)
- https://www.applevis.com/forum/ios-ipados/accessibility-duolingo
- https://duolingo.fandom.com/wiki/Frequently_asked_questions/Accessibility
- https://duoplanet.com/duolingo-score/
- https://duoplanet.com/duolingo-friends-quest/
- https://brilliant.org/help/features/
- https://brilliant.org/help/using-brilliant/
- https://brilliant.org/help/using-brilliant/what-are-leagues-and-leaderboards/
- https://rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations
- https://ustwo.com/work/brilliant/
- https://brilliant.design/blog
- https://screensdesign.com/showcase/brilliant-learn-by-doing
- https://trysavvy.com/example/brilliant-onboarding
- https://upskillwise.com/reviews/brilliant/
- https://apps.apple.com/us/app/brilliant-learn-by-doing/id913335252
- https://cedarlila.substack.com/p/a-review-brilliant
- https://trophy.so/blog/brilliant-gamification-case-study
- https://www.trustpilot.com/review/brilliant.org
