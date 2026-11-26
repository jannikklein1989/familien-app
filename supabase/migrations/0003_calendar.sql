-- KK Home · Kalender: geheime iCal-Adressen (z. B. Google Kalender) pro Person
create table if not exists calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default my_household_id() references households (id) on delete cascade,
  owner_id uuid references profiles (id) on delete set null, -- null = gemeinsamer Kalender
  label text not null default 'Kalender',
  ics_url text not null check (ics_url ~* '^(https|webcal)://'),
  created_at timestamptz not null default now()
);
alter table calendar_feeds enable row level security;
drop policy if exists "Haushalt" on calendar_feeds;
create policy "Haushalt" on calendar_feeds for all
  using (household_id = my_household_id()) with check (household_id = my_household_id());
