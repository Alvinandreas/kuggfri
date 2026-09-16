-- Felrapporter på kort: studenter (även gäster utan konto) kan flagga att ett kort är fel
-- eller otydligt. Admin ser rapporterna per deck, åtgärdar och tar bort dem.
-- Det är kvalitetsslingan mellan studenter, Alvin och examinatorn.

create table public.card_reports (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  -- Sätts automatiskt till inloggad användare (null för gäster). Kan inte anges av klienten.
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  message text not null check (length(btrim(message)) between 3 and 1000),
  contact text check (contact is null or length(contact) <= 200),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index card_reports_card_idx on public.card_reports (card_id);
create index card_reports_status_idx on public.card_reports (status, created_at desc);

revoke all on public.card_reports from anon, authenticated;
-- Vem som helst får skicka in, men bara dessa kolumner: user_id och status kommer från default.
grant insert (card_id, message, contact) on public.card_reports to anon, authenticated;
-- Läsa, åtgärda och ta bort: bara admin (RLS nedan).
grant select, update (status, resolved_at), delete on public.card_reports to authenticated;

alter table public.card_reports enable row level security;

create policy "card_reports: alla får rapportera kort i publicerade deck" on public.card_reports
  for insert to anon, authenticated
  with check (
    exists (
      select 1
      from public.cards c
      join public.decks d on d.id = c.deck_id
      where c.id = card_id and d.is_published
    )
  );

create policy "card_reports: admin läser" on public.card_reports
  for select to authenticated
  using (public.is_admin());

create policy "card_reports: admin uppdaterar" on public.card_reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "card_reports: admin tar bort" on public.card_reports
  for delete to authenticated
  using (public.is_admin());
