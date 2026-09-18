# Learning science and product craft for a university study tool (2026 synthesis)

Researchunderlag till docs/OMVARLDSANALYS.md. Sammanställt 18 september 2026 av Claude via webbsökning (~30 sökningar, ~15 hämtade primär- och sekundärkällor). På engelska. Where a number comes from a vendor blog rather than a peer-reviewed paper, it is flagged as such.

---

## Topic A — What actually makes university students learn, and what good products do with it

### A1. The evidence hierarchy (Dunlosky et al. 2013)

The single most useful map is Dunlosky, Rawson, Marsh, Nathan & Willingham (2013, *Psychological Science in the Public Interest*), which rated ten techniques on utility across learners, materials and criterion tasks:

| Technique | Utility | Why |
|---|---|---|
| Practice testing (retrieval) | **High** | Works for all ages/materials; strengthens memory and exposes gaps |
| Distributed practice (spacing) | **High** | Same study time, far better long-term retention |
| Interleaved practice | Moderate | Forces discrimination between problem types; ~90% vs <30% on a delayed geometry test in one study |
| Elaborative interrogation ("why is this true?") | Moderate | Integrates with prior knowledge; limited classroom evidence |
| Self-explanation | Moderate | Strong transfer effects |
| Rereading, highlighting, summarisation, keyword mnemonic, imagery | Low | Inconsistent, short-lived, or need heavy training |

The implication for a flashcard product is blunt: the two high-utility techniques are *exactly* what a spaced-retrieval engine does, and the low-utility ones are what students default to (rereading, highlighting). The product's job is partly to substitute the former for the latter without the student noticing the effort.

### A2. The core effects, with numbers

- **Testing effect.** Roediger & Karpicke (2006) showed repeated testing beat repeated study on a one-week delayed test. Karpicke & Blunt (2011, *Science*) then showed retrieval practice beat elaborative concept mapping on a one-week delayed test, including on inference questions, i.e. it is not "just for facts".
- **Spacing.** Cepeda et al. (2006) meta-analysed 254 studies / 317 experiments and found a large advantage for distributed over massed practice (d ≈ 0.71 in verbal recall). Cepeda et al. (2008, *Psychological Science*), with >1,350 participants, found the *optimal gap is a fraction of the retention interval*: roughly 20–40% of a one-week test delay, falling to 5–10% of a one-year delay. Practically: for an exam 3 weeks out, first review gaps of a few days are right; for a course you want to keep for a degree, gaps of weeks-to-months are right. A scheduler that knows the exam date can use this directly.
- **Interleaving.** Rohrer & Taylor (2007) and Taylor & Rohrer (2010): shuffling problem types hurt practice-session performance but roughly *doubled* scores on a test the next day. This is the cleanest illustration of Soderstrom & Bjork (2015): performance during practice is an unreliable guide to learning.
- **Desirable difficulties (Bjork).** Spacing, interleaving, varied conditions and testing all make practice feel worse and learning better. Products that optimise session "feel" (high accuracy, quick wins) can quietly optimise the wrong thing.
- **Successive relearning (Rawson & Dunlosky 2013; 2022 review).** Retrieve to a criterion (e.g. one correct recall) in a session, then relearn to criterion again in spaced sessions across days/weeks. In an authentic Intro Psych course it improved in-class exam performance and retention at 3 and 24 days versus spaced restudy and business-as-usual. This is essentially what FSRS-style scheduling does when a card is answered to criterion and returns later — a useful phrase for teachers: "relearn to criterion, repeatedly".
- **Pretesting and errors.** Attempting to answer before studying, even when you fail, improves later memory (Kornell et al. 2009; Richland et al. 2009). The **hypercorrection effect** (Butterfield & Metcalfe 2001; Metcalfe & Finn 2011): errors made with *high confidence* are more likely to be corrected after feedback, because surprising feedback captures attention. Butler et al. found the effect persists over a week, though some high-confidence errors creep back. Product implication: ask for a confidence rating (or infer it from response speed), and make the feedback on confident-but-wrong answers *visually loud*; that is where the biggest learning gains per second are.
- **Elaborative interrogation / self-explanation.** Moderate utility; low cost to support with an optional "explain why" prompt after a correct answer, or an AI "why is this the answer?" button (see B7).

### A3. Metacognition: students are miscalibrated, and practice tests only partly fix it

A 2021 study of 341 Intro Biology students (public university, four sections) found students overestimated exam performance by ~10 percentage points without practice tests and ~6.6 points with them. Practice tests raised scores (effect size ~0.37) and reduced miscalibration on average, but *did not* reduce overconfidence in the lowest quartile, while high achievers became underconfident. Dunlosky & Rawson (2012) showed overconfidence leads students to stop studying too early. Fluency illusions (rereading feels like knowing) are the mechanism.

Design consequences: (1) show *predicted* recall, not just "cards seen"; (2) make the "I knew it" judgement explicit before revealing the answer, then contrast it with the outcome; (3) avoid dashboards that let a student read "80% of cards reviewed" as "80% learned".

### A4. FSRS vs SM-2 — what it optimises and how to explain it

**The model.** FSRS describes each card with three numbers: *difficulty* (how hard the card is for you), *stability* (days until the probability of recall falls to 90%), and *retrievability* (probability of recall right now). Retrievability decays with time; each successful review raises stability, and how much it rises depends on difficulty and the retrievability at the moment of review. SM-2 (Anki's legacy algorithm, 1987) just multiplies the previous interval by an "ease factor" and cannot predict a probability at all.

**Desired retention.** The user chooses a target, and the card becomes due when its predicted retrievability drops to that value. Anki's default is 90%. The manual explains why: workload grows exponentially as the target approaches 100% — raising retention by 5 percentage points requires roughly 35% more reviews, values above ~97% are "overwhelming", and the manual discourages going much below ~70–80% because too many cards are forgotten. (Expertium's note on retention adds a subtle point: with a 90% *desired* retention, the *average* retrievability across a whole collection on any given day is ~94.7%, since most cards are not yet due.) Anki briefly shipped a "compute minimum recommended retention" tool that searched for the retention value that maximises knowledge per unit time; it was removed in 25.07 as confusing, which is itself a lesson about how much of this to expose.

**Evidence.** The open-spaced-repetition benchmark evaluates algorithms on ~10,000 Anki users and ~350M reviews (519M including same-day reviews) using log loss, RMSE(bins) and AUC. In the current table FSRS-7 (34 parameters) scores log loss ≈ 0.336–0.340 and RMSE(bins) ≈ 0.058–0.063, competitive with LSTM/GRU neural models with hundreds to thousands of parameters; only a 2.7M-parameter RWKV model beats it clearly. SM-2 is far down the table and, per Expertium's write-up, "FSRS-6 (recency) has a 99.6% superiority over Anki SM-2" — i.e. for 99.6% of users FSRS produces lower log loss. The authors themselves caveat that SM-2 was never designed to output probabilities, so the comparison is inherently unfair. The practical claim, also in Anki's docs and the Wikipedia summary, is *fewer reviews for the same retention*.

**How to say this to a normal student.** Avoid the words stability, retrievability and log loss entirely. Three sentences work: "Every card has a memory strength that fades over time. We show you a card just before you'd forget it, which is the moment when reviewing does the most good. You pick how safe you want to be — 90% is the default, and pushing it higher means a lot more reviews for a little more certainty." A single slider with a live "reviews per day" estimate communicates the trade-off better than any explanation.

### A5. Gamification: what the meta-analyses actually say

Three meta-analyses from 2020 converge on small-to-medium average effects but with unstable, context-dependent motivational effects:

- **Sailer & Homner (2020, *Educational Psychology Review*):** cognitive g = 0.49 (k=19), motivational g = 0.36 (k=16), behavioural g = 0.25 (k=9). The cognitive effect survived a high-rigour subsplit; the motivational and behavioural effects did not.
- **Huang et al. (2020, *ETR&D*):** 30 studies, N = 3,083, g = 0.464. Effects varied by sample size and duration (largest for 1–3 month interventions) but *not* by which game elements were used.
- **Bai, Hew & Huang (2020, *Educational Research Review*):** g = 0.504 across 30 interventions; qualitative synthesis found students like recognition, feedback and goal-setting, and dislike gamification that "lacks utility" or "causes anxiety and jealousy".

The cautionary tale is **Hanus & Fox (2015)**: a 16-week university course with a leaderboard and badges produced *lower* intrinsic motivation, satisfaction and empowerment over time than the same course without them, and lower final exam scores. The mechanism is the **overjustification effect** within self-determination theory (Deci & Ryan): rewards that feel controlling shift the perceived locus of causality outward. A 2023 ETR&D meta-analysis found gamification did raise intrinsic motivation, autonomy and relatedness on average, but had minimal impact on competence — again pointing to *which* elements and *how* they are framed.

Practical rules derived from SDT: elements that give informational feedback about competence (progress, mastery levels, "you now know 84% of chapter 3") help; elements that impose social comparison on an unwilling audience (public leaderboards in a graded course) risk harm, especially for the bottom half. If leaderboards exist, make them opt-in, small-group, or self-referential ("beat last week's you").

**Streaks.** The published evidence is mostly industry data. Duolingo reports (via its Group PM for Retention on Lenny's Podcast, and Growth.design's case study) that giving new users two streak freezes at the start of a streak was one of its biggest retention wins; the Growth.design write-up quotes Duolingo's former head of growth that losing a streak is "a big reason why people quit". Yu-kai Chou's analysis and others frame streaks as running on loss aversion rather than accomplishment — the distress of losing a 100-day streak exceeds the relief of keeping it. The design lesson for a study tool where the goal is *learning*, not DAU: (1) streaks should count days-with-any-review, not "all cards done"; (2) freezes should be automatic and generous (weekends, exam weeks); (3) offer a "streak repair" that costs effort rather than money; (4) never send a "your streak is about to die" notification at 23:40 — that is exactly the pattern Calm Technology and humane-design critics name as weaponised loss aversion.

### A6. Test anxiety, anonymity, and what teachers want from a dashboard

Agarwal, D'Antonio, Roediger, McDermott & McDaniel (2014, *JARMAC*) surveyed >1,400 middle and high school students: 92% said retrieval practice helped them learn and 72% said it made them *less* nervous for tests. Low-stakes retrieval reduces anxiety because it makes the real exam feel familiar. A product can lean on this in copy: "practice here so the exam isn't the first time you retrieve this".

On dashboards, Karademir et al. (2024, *Journal of Computer-Assisted Learning*, "I don't have time! But keep me in the loop") co-designed a learning-analytics "cockpit" with teachers; the headline requirement is time: teachers want a glanceable class-level view (which concepts is the class collectively weak on) and actionable prompts, not raw logs. Learning-analytics ethics work (Ifenthaler & Schumacher; the LAK "privacy paradox" paper) names purpose, access and anonymity as the three benchmarks. k-anonymity is the standard tool: an aggregate is only shown when at least k students contribute. There is no canonical k for education; 5 is a common floor in small-course settings and matches the threshold already chosen in this project. The important design point is to *state* the threshold in the UI ("shown once 5 or more students have answered") so it reads as a promise to students, not a gap in the data.

### A7. Cramming vs distributed: designing for the last three weeks

Students do cram; the research question is how to make cramming less bad. Cepeda 2008 says the optimal gap shrinks with the retention interval, so a scheduler that knows the exam is in 14 days should legitimately use short gaps — it is not "cheating" the algorithm, it is the algorithm's own prediction. The practical patterns in the field:

- **RemNote Exam Scheduler** (documented in its help centre) layers on top of SM-2/FSRS rather than replacing it: a *learning* phase where new cards are repeated until recalled twice, a *catch-up* window with temporarily higher daily goals if you fall behind (made explicit rather than silently rescheduling), "shaky card" handling (missed cards return sooner and need two consecutive successes), and a *final review* of every card just before the exam. RemNote's stated rationale is that exam-day retrievability then lands well above the 85–90% desired retention.
- **Anki "Exam Scheduler" add-on** adjusts daily new-card counts so the whole deck is introduced before the date; filtered decks / custom study are the built-in fallback for cramming.
- **Noji, Mochi, Quizlet** ship simpler "test on date X" modes that mostly compress intervals; forum guidance for "exam in a week" is to reduce desired retention to, say, 80–85% temporarily so more cards fit, then review everything the day before.

Recommendation for a Chalmers-style product: expose one field ("Exam date") and derive three behaviours from it: a new-card pace that finishes introduction ≥ 4 days out, interval compression so that everything is due at least once in the final 48 hours, and a post-exam option to "keep for the programme" (revert to long-term scheduling) or archive. Make the catch-up visible, as RemNote does; silent rescheduling destroys trust.

---

## Topic B — Product and UX craft that makes a tool feel premium and sell itself

### B1. Retention benchmarks and the levers

Industry benchmarks (AppsFlyer/Adjust-based aggregates reported by Business of Apps, UXCam, Pushwoosh, SEM Nexus for 2025–2026) put mobile education apps at roughly **D1 ≈ 14–15%, D7 ≈ 5–7%, D30 ≈ 2–3%** — the weakest category, against an all-category average of about 26/13/7%. Several of these sources note that breaking 10% at D30 puts an edtech app in the top tier. Two framing points matter for a university tool: (1) learning is naturally sessional, so D-n retention should be measured against the course calendar (weekly active during term, not daily); (2) a campus tool has a distribution advantage consumer apps lack — the teacher.

Lenny Rachitsky's activation survey gives median activation ≈ 25%, mean ≈ 34%, and two tests for a good activation metric: users who hit it should retain at ≥ 2x the rate of those who don't, and the team must be able to move it. For a flashcard tool the honest candidate is "answered ≥ 20 cards in a course deck within the first session, then returned for a second session within 3 days", not "signed up". Time-to-value should be measured in seconds: Duolingo's target of first action in ~90 seconds, before any account exists, is the reference point.

Nir Eyal's Hooked loop (trigger → action → variable reward → investment) maps cleanly: the trigger is the exam or the lecture; the action is one card; the variable reward is *finding out whether you knew it* (retrieval is intrinsically variable — no need for loot boxes); the investment is cards the student wrote or edited. Growth.design's Duolingo case study reports a "sunk-cost / investment" experiment that lifted D7 retention by +14%, and its notification tactic is notable for *self-filtering*: the app stops sending reminders that don't work. For a study app: notifications opt-in, defaulting to one per day at a time the student picks, silenced after exams, and always carrying the actual value ("12 cards due, ~4 min") rather than guilt.

### B2. Onboarding patterns

- **Delayed signup / soft walls.** Duolingo's A/B test replacing "Discard my progress" with "Later" and letting users finish a lesson before registering increased DAU by ~20% (Growth.design; First Round Review). Pattern: link → deck opens → answer cards immediately → progress is kept locally → account offered *after* the first win, framed as "save this progress".
- **Empty states.** NN/g frames the empty state as communicating system status, teaching, and offering a direct task path; it is the one screen 100% of new users see. A course deck with zero personal progress should show a single primary action ("Start with 10 cards") and a visible promise ("about 3 minutes").
- **Progressive disclosure** (Nielsen, 1995): show the retention slider, interleaving toggle, and FSRS parameters only after the student has reviewed for a week; defaults should be good enough that most never look.
- **End on a high.** Growth.design's "exit points" tactic: design a natural stopping point with a completion state after N cards rather than an infinite queue. Rawson & Dunlosky's criterion ("all of today's cards recalled once") is a natural, pedagogically honest stopping rule.

### B3. Micro-interactions and motion

Emil Kowalski's practical rules (Vercel-adjacent design engineering, widely adopted): keep UI animations under ~300 ms (a 180 ms dropdown feels more responsive than 400 ms); use ease-out for anything entering or leaving the screen, never ease-in; prefer custom curves like `cubic-bezier(0.23, 1, 0.32, 1)` over CSS defaults; `scale(0.97)` on `:active` for press feedback; never animate from `scale(0)`; make popovers origin-aware; and *remove* animation from things seen hundreds of times a day. Rauno Freiberg's "Invisible Details of Interaction Design" adds the frequency rule explicitly: high-frequency interactions should have minimal motion because novelty decays into cognitive burden, while rare or destructive actions deserve animation for assurance. For a flashcard flip that happens 200 times a session, this means a near-instant reveal (≤150 ms, or none), with celebration reserved for session completion and mastery milestones. Material 3 and Apple HIG both require honouring the OS reduce-motion setting; `prefers-reduced-motion` should swap transforms for opacity fades. Sound and haptics: opt-in only; Apple HIG treats haptics as feedback for meaningful state changes, not every tap.

### B4. Visual identity that ages well, and a Chalmers/Scandinavian sensibility

The products people cite as timeless (Linear, Things 3, Notion, Headspace, Brilliant) share: a restrained palette with one accent; generous whitespace; typographic hierarchy doing the work that decoration usually does; and illustration used sparingly and consistently. Things 3 is the canonical example of "no useless decoration" earning multiple Apple Design Awards. Duolingo is the counterexample that works *because* it commits fully to character-driven playfulness — half-committing is what looks dated.

Scandinavian design writing (Aesthetics of Design 2025; Life in Norway; Wikipedia) describes the sensibility as functionality first, minimalism *with warmth*, natural materials, and light — the concept of *lagom* (just enough). Translated to a Chalmers product: system fonts or one humanist sans (Inter, or a Swedish-designed face like Söhne-adjacent alternatives) rather than display fonts; an off-white or warm-grey surface rather than pure white; a single accent close to Chalmers' palette but not the logo; and a dark mode that is dim, not black. The strongest branding move is restraint: the product should look like it belongs in the same tab as Canvas and the course PDF without looking like either.

### B5. Word-of-mouth on campus

Mechanisms with evidence or strong precedent:

1. **Link → instant use.** The Duolingo delayed-signup data above; a lecturer pasting a deck link into Canvas that opens directly into review is the single most important growth surface.
2. **Teacher endorsement in lecture.** No product can buy this; Bai et al.'s qualitative synthesis shows students value "utility" — if the deck matches the exam, the teacher's word is enough.
3. **Screenshot-able proof.** A mastery map or "predicted recall by chapter" screen is shared; a raw streak number is less interesting to peers than "I know 91% of thermodynamics".
4. **Bring-your-own-content with AI assist** (B7) so students without a teacher-made deck still have a reason to come.
5. **Speed and offline.** The offline-first PWA literature (service worker for shell, IndexedDB as local source of truth, queued writes with last-write-wins for simple records) is well understood; one Swiss case study reported rewriting 30% of code because offline was bolted on late. Reviews must work on the tram with no signal, and sync must never lose a review.

### B6. Accessibility as advantage

WCAG 2.2 (W3C, 2023) added nine criteria; the ones that bite a study app are 2.5.8 Target Size (24×24 CSS px minimum, AA), 2.4.11 Focus Not Obscured (sticky headers must not hide the focused card), 3.3.7 Redundant Entry, and 3.3.8 Accessible Authentication (no cognitive-function tests to log in — magic links are compliant). Keyboard-first review (Space to reveal, 1–4 to grade) is both an accessibility requirement and a power-user feature. The British Dyslexia Association style guide (2023): sans-serif, left-aligned, 60–70 characters per line, no block capitals, adequate line spacing; these are simply good typography and cost nothing. Reduce-motion support is required by Apple and Material guidelines and matters to a population Apple frames around vestibular disorders (estimated 70M+ people); it also helps anyone studying tired.

### B7. AI features: useful vs gimmicky, and privacy

**Useful (with evidence).**
- *Card/MCQ generation with human review.* A 2025 systematic review and network meta-analysis in health-professions education found GPT-4-generated MCQs comparable to human-written ones on relevance, clarity and distractor quality, while Llama 2 was worse. Distractor-generation studies (Springer AIED 2024; arXiv 2024 "overgenerate-and-rank") report roughly half of generated distractors rated usable as-is by teachers, with humans preferred ~62% of the time head-to-head; LLMs are good at mathematically valid distractors and weak at anticipating real student misconceptions. The pattern that works is *overgenerate, then a human picks*: never auto-publish.
- *Explain on demand* ("why is this the answer?") and Socratic hints map directly onto elaborative interrogation and self-explanation (moderate utility in Dunlosky). Keep them behind a button so the retrieval attempt happens first.
- *Quality control.* Hallucinated facts and superficial distractors are documented failure modes; require source-grounding (the generated card must cite the lecture slide/page) and show the citation in review.

**Gimmicky.** Chat-with-your-notes as the primary interface (replaces retrieval with rereading), automatic "AI tutor" interruptions during review, and AI-generated encouragement copy.

**Privacy and institutional fit.** Chalmers' library guidance sanctions Microsoft Copilot for all students and staff, has no ChatGPT licence, publishes "Regulations for the use of AI tools in thesis work", and directs staff to its information-classification and "AI and operational information processing" policies. Sweden's IMY and DIGG issued joint guidance on generative AI in the public sector on 21 January 2025, and IMY lists AI in the public sector as a 2026 supervision focus; KTH's teacher guidance, built on it, says to strip all personal data before sending material to a generative model. A campus product should therefore: host in the EU (Sweden Central or similar), send only course content — never student names, responses or grades — to a model, log which content was sent, and let teachers turn AI generation off per course. This is also a selling point in the examiner and teacher conversation: "no student data ever leaves the EU or reaches a model."

---

## Ten takeaways for the product

1. Retrieval + spacing are the two high-utility techniques; everything else is decoration. Make them invisible defaults.
2. Use exam date to legitimately shorten gaps (Cepeda 2008), introduce all cards early, and finish with a full review in the last 48 h (RemNote pattern). Show the catch-up plan; never silently reschedule.
3. Keep FSRS's 90% default; expose one slider with a live reviews/day estimate; hide the model vocabulary.
4. Ask for confidence before revealing; make confident-wrong feedback loud (hypercorrection).
5. Report predicted recall, not cards seen (calibration).
6. Progress and mastery feedback: yes. Public leaderboards in graded courses: no, or opt-in. Streaks: generous automatic freezes, no midnight guilt notifications.
7. Activation metric: first real session + a return within 3 days. First value in <90 s, account after the first win.
8. Motion: ≤300 ms, ease-out, none on the 200th flip; celebrate only at session end and mastery milestones; honour reduce-motion.
9. Visual: warm minimal, one accent, typographic hierarchy, keyboard-first, BDA typography, WCAG 2.2 AA. Looks like it belongs next to Canvas.
10. AI: generate from slides with citations, teacher picks, nothing personal leaves the EU; explain-on-demand after the attempt, never before.

---

## Sources

Learning science
- Dunlosky et al. 2013 (AFT summary): https://www.aft.org/ae/fall2013/dunlosky
- Dunlosky et al. 2013 (journal): https://journals.sagepub.com/doi/abs/10.1177/1529100612453266
- Cepeda et al. 2008, temporal ridgeline: https://laplab.ucsd.edu/articles/Cepeda%20et%20al%202008_psychsci.pdf
- Cepeda et al. 2006 meta-analysis: https://www.yorku.ca/ncepeda/publications/CPVWR2006.html
- Karpicke & Blunt 2011: https://learninglab.psych.purdue.edu/downloads/2011/2011_Karpicke_Blunt_Science.pdf
- Rohrer & Taylor 2007: http://uweb.cas.usf.edu/~drohrer/pdfs/Rohrer&Taylor2007IS.pdf
- Taylor & Rohrer 2010: http://uweb.cas.usf.edu/~drohrer/pdfs/Taylor&Rohrer2010ACP.pdf
- Soderstrom & Bjork 2015: https://journals.sagepub.com/doi/abs/10.1177/1745691615569000
- Bjork & Bjork, desirable difficulties: https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-introducing-desirable-difficulties-into-practice-and-instruction-bjork-and-bjork.pdf
- Rawson & Dunlosky 2013, successive relearning: https://link.springer.com/article/10.1007/s10648-013-9240-4
- Rawson & Dunlosky 2022 review: https://journals.sagepub.com/doi/full/10.1177/09637214221100484
- Metcalfe & Finn 2011, hypercorrection: https://www.columbia.edu/cu/psychology/metcalfe/PDFs/MetcalfeFinn2011.pdf
- Butler et al., hypercorrection persists a week: https://link.springer.com/article/10.3758/s13423-011-0173-y
- Calibration in Intro Biology (2021): https://pmc.ncbi.nlm.nih.gov/articles/PMC8442020/
- Dunlosky & Rawson 2012, overconfidence: https://www.researchgate.net/publication/251624183
- Agarwal et al. 2014, retrieval practice and test anxiety: https://www.sciencedirect.com/science/article/abs/pii/S221136811400059X

FSRS / spaced repetition
- srs-benchmark (README): https://github.com/open-spaced-repetition/srs-benchmark
- Expertium benchmark write-up: https://expertium.github.io/Benchmark.html
- Expertium on retention: https://expertium.github.io/Retention.html
- Anki manual, deck options / FSRS: https://docs.ankiweb.net/deck-options.html
- fsrs4anki tutorial: https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md
- RemNote Exam Scheduler: https://help.remnote.com/en/articles/9102040-understanding-the-exam-scheduler
- Anki Exam Scheduler add-on: https://ankiweb.net/shared/info/1640946074

Gamification / motivation
- Sailer & Homner 2020: https://eric.ed.gov/?id=EJ1245270
- Huang et al. 2020: https://link.springer.com/article/10.1007/s11423-020-09807-z
- Bai, Hew & Huang 2020: https://www.sciencedirect.com/science/article/abs/pii/S1747938X19302908
- Hanus & Fox 2015: https://www.researchgate.net/publication/265644737
- ETR&D 2023 SDT meta-analysis: https://link.springer.com/article/10.1007/s11423-023-10337-7
- Overjustification effect: https://en.wikipedia.org/wiki/Overjustification_effect
- Growth.design, Duolingo retention: https://growth.design/case-studies/duolingo-user-retention
- First Round Review, Duolingo A/B testing: https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/
- Lenny's Podcast, Duolingo streaks (summary): https://www.recall.it/summary/lennys-podcast/behind-the-product-duolingo-streaks-or-jackson-shuttleworth-group-pm-retention-team
- Yu-kai Chou on streak design: https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/

Dashboards / privacy
- Karademir et al. 2024, teacher LA cockpit: https://onlinelibrary.wiley.com/doi/10.1111/jcal.12997
- LAK 2020 privacy paradox: https://dl.acm.org/doi/10.1145/3375462.3375536
- Differential privacy in LA (2025): https://arxiv.org/pdf/2501.01786

Product / UX
- Lenny, activation rate benchmarks: https://www.lennysnewsletter.com/p/what-is-a-good-activation-rate
- Business of Apps, education benchmarks: https://www.businessofapps.com/data/education-app-benchmarks/
- UXCam retention benchmarks: https://uxcam.com/blog/mobile-app-retention-benchmarks/
- SEM Nexus D1/D7/D30 by category: https://semnexus.com/day-1-day-7-day-30-retention-benchmarks-app-category-2026
- Emil Kowalski, 7 practical animation tips: https://emilkowal.ski/ui/7-practical-animation-tips
- Rauno Freiberg, Invisible Details: https://rauno.me/craft/interaction-design
- Calm Tech principles: https://www.calmtech.institute/calm-tech-principles
- Empty-state patterns (NN/g-derived): https://usertourkit.com/blog/empty-states-that-convert-onboarding-design-patterns
- Progressive disclosure: https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/
- Things 3 review (MacStories): https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/
- Scandinavian minimalism: https://www.aesdes.org/2025/01/22/scandinavian-minimalist-design/
- Local-first PWA architecture: https://blog.openreplay.com/local-first-pwa-architecture/
- PWA offline pitfalls (Edana): https://edana.ch/en/2026/04/05/can-a-web-app-pwa-really-work-offline-like-a-native-app/

Accessibility
- W3C, new in WCAG 2.2: https://w3.org/WAI/standards-guidelines/wcag/new-in-22/
- WCAG 2.2 spec: https://www.w3.org/TR/WCAG22/
- BDA Dyslexia Style Guide 2023: https://cdn.bdadyslexia.org.uk/uploads/documents/Advice/style-guide/BDA-Style-Guide-2023.pdf
- WebKit, responsive design for motion: https://webkit.org/blog/7551/responsive-design-for-motion/

AI and policy
- Health-professions MCQ generation meta-analysis: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12758716/
- Distractor generation with predictive prompting: https://link.springer.com/chapter/10.1007/978-3-031-74627-7_4
- Overgenerate-and-rank distractors: https://arxiv.org/pdf/2405.05144
- Chalmers library, AI for teachers: https://guides.lib.chalmers.se/c.php?g=728318&p=5304143
- KTH generative AI considerations: https://intra.kth.se/en/utbildning/systemstod/generativ-ai/riktlinjer-1.1405092
- IMY guidance on GDPR and AI: https://www.dataguidance.com/news/sweden-imy-publishes-guidance-gdpr-and-ai
- Bird & Bird, Sweden AI tracker: https://www.twobirds.com/en/capabilities/artificial-intelligence/ai-legal-services/ai-regulatory-horizon-tracker/sweden
