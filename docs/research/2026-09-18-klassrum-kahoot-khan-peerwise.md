# Classroom & Course-Integrated EdTech, 2026

Researchunderlag till docs/OMVARLDSANALYS.md. Sammanställt 18 september 2026 av Claude via webbsökning (32 sökningar, 22 hämtade sidor). På engelska. Scope: live-lecture engagement tools, mastery/practice platforms, student-authored question banks, university assessment engines, exam-prep "readiness" products, and the Swedish/Chalmers context.

## 1. Kahoot!: the live-game loop and its limits

**The loop.** Host opens a "kahoot", the screen shows a game PIN (plus QR), the lobby fills with nicknames while the signature music plays, then each question runs on a countdown with four coloured shapes; after every question the projected screen shows the answer distribution and a top-5 scoreboard, and the game ends with an animated three-step podium. Wooclap's 2026 review confirms the current product still hinges on "PIN → lobby with music → real-time play → podium-style leaderboard", now with 14 question types split into "Testing knowledge" (MCQ, true/false, type answer, slider, pin, puzzle) and "Collect opinions" (poll, scale, NPS, word cloud, open-ended, brainstorm).

**Scoring.** Points per question are 0, 1000 or 2000 (host-selectable). Speed-scaled formula: `points = (1 − (response_time / question_timer) / 2) × points_possible`, so instant answers earn the full 1000 and last-second answers earn ~500. The **answer-streak bonus** (introduced 2016) added +100 for the 2nd consecutive correct, +200 for the 3rd, capped at +500 from streak 5. Notably, **Kahoot removed streak points in March 2020** because the bonus widened the gap for underperforming students; streaks are still displayed but no longer award points. This is a rare public example of a gamification mechanic being rolled back on equity grounds.

**Why it creates energy.** Wang & Tahir's 2020 review of 93 studies (Computers & Education 149) concludes Kahoot has a positive effect on learning performance, classroom dynamics, attitudes and anxiety, and NTNU's impact case notes ~70M monthly active users. The synchronous countdown plus a shared screen is the core: everyone commits at the same moment and sees the class distribution immediately.

**Kahoot fatigue / wear-out.** Wang's 2015 "wear-out" study (one Kahoot per lecture for a semester of software-engineering students) found the only statistically significant drop was in classroom dynamics: 52 % agreed Kahoot increased topic-relevant communication with classmates vs 67 % among first-time users. Motivation and engagement fell slightly but stayed positive; competition was the element that kept attention. A 2024 Frontiers three-term language study and a 2025/26 Penn State–NC State study reported no wear-out when stakes were low and feedback, not winning, was emphasised.

**Criticism.** Wang & Tahir list student complaints: connectivity failures, unreadable projected text, no way to change an answer, time-pressure stress, insufficient response time, competitive anxiety, and inability to catch up after a wrong answer. Teachers reported that speed-based scoring "undermines reflection and encourages guessing". A 2022 systematic review of Kahoot challenges in HE (ACM) reports scoring caused anxiety in about 25 % of students and that bottom-ranked students became uncomfortable because the leaderboard is public. Kahoot's own 2026 study at UAB and UCI intro biology (exams ≥70 % of grade) counters that non-graded Kahoot ranked less anxiety-inducing than most other activities; only clicker questions and TA sessions scored lower at UCI, and 75 % of UAB comments on game elements were positive. Net: works when ungraded, short, and used for retrieval rather than ranking.

**Self-paced and study modes.** "Assignments" (challenge mode) let students play at their own pace by a deadline; Kahoot!+ Study adds flashcards, practice, and test modes; the AI generator builds a kahoot from a topic, file or URL. Kahoot's own 2024 survey of 1,013 US college students is a useful framing: 67 % use re-reading as their main strategy, 50 % report overwhelming stress weekly or daily, 42 % have skipped an exam, 63 % rate interactive digital study tools as very or extremely important.

**Kahoot! 360 and pricing backlash.** Business is split out as Kahoot! 360 ($19–99/month per host intro pricing; 360 Spirit $6,000/yr for 25 licences; Enterprise $5/employee/month, 50+ seats). On the education side, the free tier is capped at **10 participants per session**, and the paid ladder runs $36–228/year with the richer question types locked to top tiers. Reviewers consistently describe the free tier as too small for a real class and the tier structure as confusing; this is the main reason teachers migrate to Blooket, Gimkit, Wayground and Wooclap.

## 2. Khan Academy: mastery learning and Khanmigo

**Mastery mechanics.** Each skill carries 100 mastery points across four levels (Attempted → Familiar → Proficient → Mastered). Practice exercises can only take a skill to Proficient; **quizzes, unit tests, course challenges and Mastery Challenges** move skills up (or down). A Mastery Challenge reviews 3 previously-learned skills with 2 questions each: both correct = level up, both wrong = level down, split = unchanged; one challenge per 12 hours, and an unfinished one resets after 12 hours. Since the 2018 mastery mechanics update, unit mastery alone can reach 100 % (the Course Challenge no longer owns a separate 20 %); it remains as an accelerator for students with prior knowledge. Hints and the linked video are one click away inside every exercise, and using a hint does not count as a correct answer.

**What they abandoned.** Energy points still exist but are explicitly "a measure of effort, not mastery". Badges tied to the old Missions system were retired when Course Mastery became the only model, further badges disappeared in a codebase migration, and the 2025 "Reimagined for Learners" redesign removed avatars. Help-centre threads ("Can we bring back badges?", "early-2000s-gamification-style energy-points banners") show the direction: Khan has moved from collectible gamification toward mastery state as the only progress signal.

**Teacher dashboard.** The Activity overview report has Activity, Skills and Mastery tabs. The Skills tab is a class × skill grid colour-coded blue (Mastered), green (Proficient), yellow (Familiar), grey (Attempted), sortable by student, skill or completion, with drill-down to time per skill, attempts and specific wrong problems. This is one of the clearest "which concept is weak, for whom" screens in the segment.

**Evidence.** Khan's November 2024 efficacy study (~350,000 US grade 3–8 students, 2022–23): 30+ min/week (18+ h/year) associated with ~20 % greater-than-expected MAP Growth gains, effect size 0.36, consistent across demographic groups. Only ~9 % of students reached that dosage; 9–18 h/year gave ~7 %. Each additional skill brought to Proficient/Mastered ≈ 0.5 percentage-point gain. A 2025/26 PNAS paper also studies real-world Khan usage. The honest caveat is that this is K-8 mathematics with quasi-experimental design, not university.

**Khanmigo.** Socratic by design: it is prompted not to give the answer but to ask the next question. Khan's own experiment programme (Oct 2025–Apr 2026, ~15M tutoring threads, ~20 experiments) tracked latency, next-item correctness and "active" cognitive engagement. Feeding the tutor a summary of the student's recent problem history gave +3.4 % next-item correctness; surfacing unmastered prerequisites +2.7 %; combined +6.1 %. Restricting the agent to the math the student had already done halved answer giveaways. Independent evidence is thinner: a 2025 study with 69 undergraduates (lunar phases concept inventory) found gains in all conditions but no significant difference between Khanmigo and Google search; EdWeek (July 2025) notes there is still no comprehensive outcome data after two years.

## 3. Live-lecture engagement: Mentimeter, Wooclap, Socrative

**Two-minute launch.** All three follow the same pattern: presenter opens a saved deck, the first slide shows a join code and QR; students go to menti.com / wooclap.com / socrative.com (or scan), type a code, and answer from the phone browser without an account; results render live on the projector. Mentimeter's 8-digit code can rotate, but the **QR code and join link are permanent per presentation**, so a lecturer can print the QR on slide 1 of every lecture. Mentimeter has 13 question types (word cloud, scales, ranking, 2×2 grid, quiz with leaderboard); Wooclap has 21 (adds matching, fill-in-the-blanks, label-an-image, find-on-image). Wooclap's differentiator for universities is **LTI into Canvas/Moodle/Blackboard and per-student reports** (Excel/PDF); Mentimeter's reports show participation only, not who got what right. Socrative is the simplest: quizzes, "Quick Question", Exit Ticket, and **Space Race** (avatars advance across the screen per correct answer; team or individual). Free tiers: Mentimeter 50 participants/month, Wooclap 1,000 participants/event.

**Swedish licences (verified).** Uppsala: campus agreement, unlimited licences. Lund: full licence via Lucat ID, participants "always completely anonymous unless they write their name", explicitly *not* to be used for examination because results cannot be securely stored, no Canvas integration (embed instead). KTH: campus licence for all staff and students; warns that responses can be linked to individuals and to avoid sensitive personal data in questions. Chalmers: I could not find a public Chalmers page confirming a Mentimeter or Wooclap campus licence in this pass; treat as unverified. Slido and Poll Everywhere exist but do not appear in Swedish university guidance.

## 4. PeerWise: student-authored MCQs

Built by Paul Denny at Auckland (2008), still free. Students write MCQs with explanations, answer peers' questions, rate difficulty and quality (0–5), and comment; the instructor sees everything but authorship is pseudonymous to peers. Gamification is deliberately private-first: 26 badges in three families (goal-setting, e.g. "Obsessed" for 10 consecutive active days; instructional, for discovering features; reputation, e.g. "Good question author" for five Excellent ratings), plus anonymous leaderboards and a reputation score.

**Evidence.** The badge RCT (>1,000 students, 4 weeks, March 2012): badges-on students submitted 22 % more answers and were active on more distinct days; **no effect on question authoring**. Kay et al. 2020 (BJET) is the multi-institutional, multidisciplinary evaluation; earlier Auckland work found active PeerWise users outperform inactive ones on final exams, including on *written* (not MCQ) questions, suggesting more than drill. A 2018 Postgraduate Medical Journal study of a formative student-authored bank found the same association with summative performance. Caveat in every paper: self-selection; the effect of *authoring* is weaker than the effect of *answering*.

**UX.** The interface is the same server-rendered tables it launched with (course-code login, list views, no mobile layout); I found no published usability complaint, so treat "dated UI" as observation rather than sourced finding. The documented pain point is question quality control: students struggle with low-quality peer questions unless the instructor moderates or weights by rating.

## 5. Perusall and the "confusion report"

Perusall (Mazur's group, Harvard) turns reading into social annotation. Mechanics: assign a PDF/video, students annotate in threads with upvotes; an algorithm auto-grades engagement on up to 7 criteria and syncs grades to the LMS; small groups (~20) keep threads readable in an 800-seat lecture. The instructor-facing gem is the **Confusion Report**: an automatically generated digest of the passages with the most questions/confusion plus the best student annotations, meant to be read the morning before class. Miller, Lukoff, King & Mazur (Frontiers in Education 2018, flipped intro physics) found annotation scores and total annotations predicted exam performance; Perusall claims 90 %+ reading completion vs the usual 20–30 %.

## 6. Teacher/examiner dashboards: what good looks like

What a lecturer actually wants before an exam is three questions answered: which concepts are weak, who is at risk, and whether the questions themselves are sound. Best-of-breed screens:

- **Khan Academy Skills tab**: class × skill grid, four-colour mastery, sortable, drill-down to wrong items. The "concept heatmap" pattern.
- **Canvas New Quizzes item analysis**: per-quiz High/Low/Mean, SD, mean elapsed time, Cronbach's alpha; per-item difficulty and **discrimination index** (top 27 % minus bottom 27 %; red ≤ 0.24, green ≥ 0.25). This tells an examiner which questions to discard. Outcomes Analysis needs ≥ 3 submissions and ignores item-bank questions.
- **Perusall Confusion Report**: qualitative "what to cover tomorrow" digest.
- **Wooclap per-participant report** and **Wayground's** per-question accuracy grid are the live-tool equivalents; Mentimeter deliberately does not do per-student.
- **AMBOSS/UWorld** (below) for percentile and predicted-score views.

Anonymity is the fault line. Swedish guidance (Lund, KTH) treats live polls as anonymous formative tools and warns against re-identification; Kahoot shows nicknames on a public podium; PeerWise is pseudonymous to peers, named to the instructor. A GDPR-clean design for a Chalmers course is: individual data visible to the student, cohort aggregates and per-concept stats to the examiner, with an explicit small-cohort threshold before any aggregate is shown (the same reasoning behind Perusall's "report may not be available for small numbers").

## 7. Course integration and distribution

- **LTI/Canvas.** Chalmers runs Canvas. Möbius is wired in as an External Tool (`chalmers.mapleserver.com/mv-mobius/lti/`); "duggor" appear as Canvas assignments, open Möbius in a new tab, and scores flow back with a short delay; Canvas grading schemes render pass/fail (e.g. 85.6 % = 6/7) and a gateway module must gate access because any Chalmers login could otherwise reach the assignment. Numbas (Newcastle, Apache 2.0, LTI + SCORM, CAS-randomised questions, GeoGebra/JSXGraph) is used by some Chalmers colleagues; STACK is the Moodle-origin equivalent (not verified at Chalmers in this pass).
- **Zero-friction launch.** The pattern that works in lectures is *a permanent QR on a slide + no student account*. Mentimeter's persistent QR, Socrative's single room code, and Kahoot's PIN all avoid sign-up. Anything requiring an account before the first answer loses the room.
- **Cadence.** None of the live tools do schedule-aware nudges. Khan Academy assignments have due dates and teacher reminders; Perusall has deadlines and reminders; Wayground/Blooket send homework reminders. A course-calendar-aware cadence ("dugga Friday, exam in 12 days") is not something any incumbent ships.

## 8. Group and social mechanics: what works, what backfires

Works: **team modes** (Kahoot team mode, Socrative Space Race teams, Quizlet Live where answer options are split across devices so "one dominant student can't hijack"); **KitCollab** in Gimkit (students submit questions for teacher approval, live or async, the same authoring loop as PeerWise but frictionless); Blooket's economy modes (Gold Quest: answers become chest picks that grant, multiply or steal gold, which teachers note decouples score from knowledge); PeerWise's private badges; social-proof aggregates.

Backfires: Li et al. 2024 (JCAL systematic review) finds individual leaderboards demotivate lower-ranked students and team leaderboards are more constructive; a 2025 Journal of Computing in Higher Education study found a lecture leaderboard reduced female psychology students' social engagement. Kahoot's own streak-point removal is the vendor-side admission. Design rule from the 2026 Penn State/NC State work: low stakes, clear rules, feedback over winning, equal chance to succeed, and both high- and low-competitive students then benefit equally with no wear-out.

## 9. Exam-prep "readiness" features

The high-stakes benchmark is medical: **AMBOSS Score Predictor** ingests QBank accuracy, difficulty and topic coverage plus entered NBME/UWorld self-assessment scores, uses a Bayesian model and returns a **predicted score range and a probability of passing**, recalibrating as you study and comparing to peers; third-party reviews put it within 7–10 points. **UWorld** Performance tab: Overall (cumulative %, questions done), Reports (subject/system/topic), Graphs (by date and by test), percentile rank vs all users, per-option selection percentages, average time per question. Both stress that a full-length self-assessment predicts better than QBank percentage. Transferable patterns: readiness as a range not a number, per-topic breakdown with peer percentile, confidence that grows with volume, and an explicit "based on N questions" disclosure.

## 10. Swedish and Chalmers context

- **Kollin** (kollin.io; KTH startup, 2018, KTH Innovation pre-incubator): old exam tasks sorted by topic and difficulty so students "start easy and climb", KAI chatbot, study plans, progress stats vs peers, custom quizzes. ~5,000 users by August 2019; today claims 29+ institutions and ~4,250 courses, best coverage for basic courses at KTH, Chalmers, Uppsala, LiU, Lund, LTU. Sveriges Ingenjörer gives student members free Gold year one (2026–27) and 50 % years two–three. This is the closest Swedish incumbent.
- **TentaPortalen** (tenta.chs.se, Chalmers Studentkår): exam statistics, pass rates, course evaluations and old exams per course (site was unreachable during this pass; description from search index).
- **Chalmerstenta.se**: student-built, 2,000+ exams, 300+ course codes (ACE080–VTA137), crowdsourced uploads with a contributor leaderboard (top uploader 24 exams). Minimal UI.
- **MyAccount.se**: run privately by a student, exams + facit for Chalmers, KTH, LiU, Lund, GU, SU, LTU and more, readable in-browser, plus tentastatistik and law-text search.
- **Extentor.se** (LTH) and **extentor.nu** (national), **Memmo** (AI quizzes/flashcards from old exams, Swedish-language).
- Department archives at Chalmers (cse.chalmers.se, math.chalmers.se "gamla tentor") remain flat HTML lists.
- "Studieboken", "Kunskapskollen", "Tentamensbanken" and a Studentlitteratur flashcard app: no evidence found. **Glosboken** is K-12 vocabulary. Quizlet is used ad hoc via public Swedish sets, with no institutional presence.

**Gap summary for a Chalmers-integrated flashcard/quiz engine:** nobody combines (a) course-schedule-aware cadence, (b) per-concept examiner insight with a small-cohort anonymity threshold, (c) a UWorld/AMBOSS-style readiness range built on "tentor", and (d) PeerWise-style student authoring with a modern, mobile UI. Kollin is closest on content, Khan on mastery mechanics, Perusall on examiner insight, and Mentimeter on zero-friction launch.

## Sources

- https://support.kahoot.com/hc/en-us/articles/115002303908-How-points-work
- https://medium.com/inside-kahoot/experimenting-with-answer-streaks-to-help-make-learning-awesome-3b3357e42595
- https://gamesadda.in/gaming/kahoot-scoring-explained/
- https://www.wooclap.com/en/blog/kahoot-review/
- https://www.wooclap.com/en/blog/kahoot-pricing/
- https://kahoot360.com/pricing/
- https://kahoot.com/kahoot-study-survey/
- https://kahoot.com/blog/2026/09/14/kahoot-impact-high-stakes-lecture-courses-benefit-from-low-stakes-game-based-review/
- https://kahoot.com/blog/2026/01/14/kahoot-impact-competition-education-research/
- https://research.gold.ac.uk/id/eprint/39435/ (Wang & Tahir 2020)
- https://www.sciencedirect.com/science/article/pii/S0360131520300208
- https://www.sciencedirect.com/science/article/abs/pii/S0360131514002516 (wear-out effect)
- https://dl.acm.org/doi/fullHtml/10.1145/3568739.3568753
- https://www.ntnu.edu/documents/139945/1377543114/Impact-Kahoot.pdf
- https://support.khanacademy.org/hc/en-us/articles/360037127892-What-are-Mastery-Challenges-in-course-mastery
- https://support.khanacademy.org/hc/en-us/community/posts/360023249611-Update-Mastery-Mechanics-Changes-September-2018
- https://support.khanacademy.org/hc/en-us/articles/202487710-What-are-energy-points-badges-and-avatars
- https://support.khanacademy.org/hc/en-us/community/posts/45711186330509-Reimagined-for-Learners
- https://support.khanacademy.org/hc/en-us/articles/360031052391-How-do-I-use-the-Activity-Skills-and-Mastery-tabs-on-the-Activity-overview-report
- https://blog.khanacademy.org/khan-academy-efficacy-results-november-2024/
- https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/
- https://www.edweek.org/technology/opinion-can-an-ai-powered-tutor-produce-meaningful-results/2025/07
- https://www.researchgate.net/publication/396808798_Leveraging_Khanmigo_Generative_AI-Powered_Tool_for_Personalized_Tutoring_to_Learn_Scientific_Concepts
- https://help.mentimeter.com/en/articles/422271-share-the-qr-code
- https://help.mentimeter.com/en/articles/2780681-how-long-is-my-join-code-valid
- https://www.wooclap.com/en/blog/mentimeter-vs-wooclap/
- https://intra.kth.se/utbildning/systemstod/mentimeter/mentimeter-1.1057127
- https://www.education.lu.se/digitala-verktyg/mentimeter
- https://mp.uu.se/web/info/undervisa/e-larande/undervisa-online/mentimeter
- https://www.education.lu.se/verktyg/externa-applikationer-och-integration-i-canvas
- https://e.ff.unipo.sk/mod/book/view.php?id=20318&chapterid=670 (Socrative Space Race / Exit Ticket)
- https://peerwise.cs.auckland.ac.nz/docs/community/do_badges_work/
- https://bera-journals.onlinelibrary.wiley.com/doi/10.1111/bjet.12754 (Kay et al. 2020)
- https://dl.acm.org/doi/10.1145/1597849.1384293 (Denny et al., Student use of PeerWise)
- https://academic.oup.com/pmj/article/94/1108/97/6984023
- https://www.perusall.com/
- https://its.umich.edu/academics-research/teaching-learning/perusall/features
- https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2018.00008/full (Miller, Lukoff, King, Mazur)
- https://community.canvaslms.com/t5/Canvas-Resource-Documents/New-Quizzes-Quiz-and-Item-Analysis/ta-p/580197
- https://www.math.chalmers.se/intern/lararinfo/MapleTA/canvas/
- https://academic.oup.com/teamat/article/45/1/139/8418236 (Möbius case study, mentions Chalmers/Numbas)
- https://www.numbas.org.uk/
- https://ditchthattextbook.com/game-show-classroom-comparing-the-big-5/
- https://edtechpicks.org/2022/10/students-create-review-game-in-gimkit/
- https://nibble-app.com/blog/blooket-vs-quizizz (Wayground rename)
- https://onlinelibrary.wiley.com/doi/10.1111/jcal.13077 (Li 2024, leaderboards in HE)
- https://link.springer.com/article/10.1007/s12528-025-09438-4
- https://support.amboss.com/hc/en-us/articles/25051203159313-USMLE-Score-Predictor
- https://step2predictor.com/uworld-vs-amboss.html
- https://medical.uworld.com/usmle/features/
- https://nursing.uworld.com/blog/what-is-a-good-uworld-nclex-score/
- https://kollin.io/
- https://www.kth.se/om/innovation/om/nyheter/kth-startupen-som-halverar-din-pluggtid-1.921106
- https://www.sverigesingenjorer.se/medlemskap/plugga-smart-med-kollin/
- https://tenta.chs.se/sv/
- https://chalmerstenta.se/
- https://myaccount.se/
- https://www.extentor.se/
- https://www.memmo.org/sv/magazine/examarchive
- https://play.google.com/store/apps/details?id=se.glosboken.app
