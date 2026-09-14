-- Nytt studieläge "kluriga kort" (tricky). Loggas i study_sessions som övriga lägen.
alter table public.study_sessions drop constraint if exists study_sessions_mode_check;
alter table public.study_sessions
  add constraint study_sessions_mode_check check (mode in ('fsrs', 'free', 'random', 'tricky'));
