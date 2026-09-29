-- Tentaläget (docs/TENTOR.md, Alvins beslut 29 sep 2026).
--
-- - exams: kursens gamla tentor med uppgifter och facit (jsonb). Synkas av innehållsverktyget från
--   material/<kurs>/tentor/ (utanför git). Bara redaktörer läser tabellen direkt; studenterna får
--   tentan via servern utan facit, och facit först när de lämnat in.
-- - exam_attempts: en students försök (svar, resultat, egna bedömningar av skrivuppgifter).
--   Bara egna rader.
-- - decks.exam_mode_open: tentaläget är låst för studenter tills examinatorn öppnar det.
--
-- Expanderande: nya tabeller och en ny kolumn med standardvärde.

alter table public.decks add column exam_mode_open boolean not null default false;
comment on column public.decks.exam_mode_open is 'Tentaläget öppet för studenterna (öppnas av examinator eller admin när föreläsningarna är klara).';

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  key text not null,
  title text not null,
  exam_date date,
  duration_minutes integer not null check (duration_minutes > 0),
  max_points numeric not null check (max_points > 0),
  grade_limits jsonb not null default '[]'::jsonb,
  aids text,
  instructions text,
  source text,
  status text not null default 'utkast' check (status in ('utkast', 'publicerad')),
  questions jsonb not null,
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deck_id, key)
);

create index exams_deck_idx on public.exams (deck_id, exam_date desc);

create trigger exams_set_updated_at
  before update on public.exams
  for each row execute function public.set_updated_at();

alter table public.exams enable row level security;

-- Redaktörer (admin och kursens examinatorer) läser och skriver. Studenter läser aldrig direkt:
-- facit ligger i questions.
create policy "exams: redaktör läser" on public.exams
  for select to authenticated
  using (public.can_edit_deck(deck_id));

create policy "exams: redaktör skriver" on public.exams
  for all to authenticated
  using (public.can_edit_deck(deck_id))
  with check (public.can_edit_deck(deck_id));

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb not null default '{}'::jsonb,
  -- Rättningen vid inlämning (lib/tentor/grade.ts) och studentens egna bedömningar.
  result jsonb,
  self_grades jsonb not null default '{}'::jsonb,
  points numeric,
  grade text
);

create index exam_attempts_user_idx on public.exam_attempts (user_id, exam_id, started_at desc);

alter table public.exam_attempts enable row level security;

-- Studenten läser, startar och raderar sina egna försök. Svar, inlämning, rättning och egna
-- bedömningar skriver servern (service role) efter att ha kontrollerat ägare och tid, så att
-- ingen kan sätta poäng, betyg eller submitted_at själv och därmed se facit utan att lämna in.
create policy "exam_attempts: läsa egna" on public.exam_attempts
  for select to authenticated
  using (user_id = auth.uid());

create policy "exam_attempts: starta egna" on public.exam_attempts
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "exam_attempts: radera egna" on public.exam_attempts
  for delete to authenticated
  using (user_id = auth.uid());

revoke insert, update on public.exam_attempts from anon, authenticated;
grant insert (exam_id) on public.exam_attempts to authenticated;

-- ÅNGRA (se docs/ATERSTALLNING.md):
-- drop table if exists public.exam_attempts;
-- drop table if exists public.exams;
-- alter table public.decks drop column exam_mode_open;
