-- KK Home · Phase 1 Schema
-- Ein Haushalt, mehrere Mitglieder. Jede Tabelle hängt an household_id,
-- Row-Level-Security lässt nur Mitglieder des Haushalts lesen und schreiben.

create extension if not exists pgcrypto;

-- ───────────── Haushalt & Profile ─────────────
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Unser Zuhause',
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references households (id) on delete set null,
  display_name text not null,
  color text not null default 'jannik', -- Token-Name der Personenfarbe
  created_at timestamptz not null default now()
);

-- Hilfsfunktion: Haushalt des eingeloggten Users (security definer, damit RLS nicht rekursiv wird)
create or replace function my_household_id() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from profiles where id = auth.uid()
$$;

-- Haushalt anlegen und sich selbst eintragen
create or replace function create_household(p_name text, p_display_name text, p_color text default 'jannik')
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  insert into households (name) values (coalesce(nullif(p_name, ''), 'Unser Zuhause')) returning id into hid;
  insert into profiles (id, household_id, display_name, color)
  values (auth.uid(), hid, p_display_name, p_color)
  on conflict (id) do update set household_id = excluded.household_id,
    display_name = excluded.display_name, color = excluded.color;
  return hid;
end $$;

-- Per Einladungscode beitreten
create or replace function join_household(p_code text, p_display_name text, p_color text default 'irene')
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  select id into hid from households where invite_code = upper(trim(p_code));
  if hid is null then raise exception 'Einladungscode unbekannt'; end if;
  insert into profiles (id, household_id, display_name, color)
  values (auth.uid(), hid, p_display_name, p_color)
  on conflict (id) do update set household_id = excluded.household_id,
    display_name = excluded.display_name, color = excluded.color;
  return hid;
end $$;

-- ───────────── To-dos ─────────────
create table todos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default my_household_id() references households (id) on delete cascade,
  title text not null,
  notes text,
  assignee_id uuid references profiles (id) on delete set null, -- null = beide
  due_date date,
  -- {"freq":"daily|weekly|monthly|yearly","interval":1,"mode":"fixed|after_done"}
  recurrence jsonb,
  done_at timestamptz,
  done_by uuid references profiles (id) on delete set null,
  created_by uuid default auth.uid() references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on todos (household_id, done_at, due_date);

-- ───────────── Einkauf ─────────────
create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default my_household_id() references households (id) on delete cascade,
  name text not null,
  quantity text,
  category text not null default 'Sonstiges',
  checked boolean not null default false,
  source_recipe_id uuid,
  created_by uuid default auth.uid() references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on shopping_items (household_id, checked);

-- ───────────── Verträge, Abos, Einnahmen ─────────────
create table contracts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default my_household_id() references households (id) on delete cascade,
  name text not null,
  provider text,
  category text not null default 'Sonstiges',
  owner_id uuid references profiles (id) on delete set null, -- null = gemeinsam
  direction text not null default 'expense' check (direction in ('expense', 'income')),
  amount numeric(10, 2) not null default 0,
  "interval" text not null default 'monthly' check ("interval" in ('monthly', 'quarterly', 'yearly')),
  start_date date,
  min_term_months int,
  renewal_months int,
  notice_value int,
  notice_unit text default 'months' check (notice_unit in ('days', 'weeks', 'months')),
  monthly_cancellable_after_min_term boolean not null default false,
  cancel_url text,
  customer_number text,
  notes text,
  status text not null default 'active' check (status in ('active', 'cancelled', 'ended')),
  end_date date,
  created_at timestamptz not null default now()
);
create index on contracts (household_id, status);

-- ───────────── Essen (Wunschgerichte & Rezepte, Grundform) ─────────────
create table recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default my_household_id() references households (id) on delete cascade,
  title text not null,
  url text,
  wished_by uuid references profiles (id) on delete set null,
  is_wish boolean not null default true,
  is_favorite boolean not null default false,
  ingredients text, -- eine Zutat pro Zeile; strukturierte Zutaten folgen in Phase 2
  notes text,
  last_cooked_at date,
  created_at timestamptz not null default now()
);

-- ───────────── Push ─────────────
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table reminders_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  kind text not null,       -- z. B. contract_deadline_30
  object_id uuid not null,
  sent_for date not null,   -- Stichtag, verhindert doppelte Pushes
  sent_at timestamptz not null default now(),
  unique (kind, object_id, sent_for)
);

-- ───────────── Row-Level-Security ─────────────
alter table households enable row level security;
alter table profiles enable row level security;
alter table todos enable row level security;
alter table shopping_items enable row level security;
alter table contracts enable row level security;
alter table recipes enable row level security;
alter table push_subscriptions enable row level security;
alter table reminders_log enable row level security;

create policy "eigener Haushalt lesen" on households for select using (id = my_household_id());
create policy "eigener Haushalt ändern" on households for update using (id = my_household_id());

create policy "Profile im Haushalt lesen" on profiles for select
  using (id = auth.uid() or household_id = my_household_id());
create policy "eigenes Profil ändern" on profiles for update using (id = auth.uid());

create policy "Haushalt" on todos for all
  using (household_id = my_household_id()) with check (household_id = my_household_id());
create policy "Haushalt" on shopping_items for all
  using (household_id = my_household_id()) with check (household_id = my_household_id());
create policy "Haushalt" on contracts for all
  using (household_id = my_household_id()) with check (household_id = my_household_id());
create policy "Haushalt" on recipes for all
  using (household_id = my_household_id()) with check (household_id = my_household_id());

create policy "eigene Push-Abos" on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- reminders_log: nur Service-Role (Edge Function), daher keine Policy.

-- ───────────── Realtime ─────────────
alter publication supabase_realtime add table todos, shopping_items, contracts, recipes;
