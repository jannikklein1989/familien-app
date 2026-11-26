-- KK Home · Wochenplan, ein Foto pro Gericht, Airfryer & Ninja Creami
-- Im Supabase-Dashboard unter "SQL Editor" einmal komplett ausführen. Mehrfaches Ausführen schadet nicht.

-- ───────────── Rezepte: Foto + zuletzt gekocht ─────────────
alter table recipes add column if not exists photo_path text;      -- Pfad im Storage-Bucket recipe-photos
alter table recipes add column if not exists last_cooked_at date;  -- gab es schon in 0001, zur Sicherheit

-- Gerätenamen vereinheitlichen: "Heißluftfritteuse" heißt jetzt "Airfryer"
update recipes set appliances = array_replace(appliances, 'Heißluftfritteuse', 'Airfryer')
where 'Heißluftfritteuse' = any(appliances);

-- ───────────── Wochenplan ─────────────
create table if not exists meal_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default my_household_id() references households (id) on delete cascade,
  day date not null,
  recipe_id uuid not null references recipes (id) on delete cascade,
  on_list boolean not null default false, -- Zutaten schon auf der Einkaufsliste
  created_by uuid default auth.uid() references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists meal_plan_household_day on meal_plan (household_id, day);

alter table meal_plan enable row level security;
drop policy if exists "Haushalt" on meal_plan;
create policy "Haushalt" on meal_plan for all
  using (household_id = my_household_id()) with check (household_id = my_household_id());

do $$ begin
  alter publication supabase_realtime add table meal_plan;
exception when duplicate_object then null; end $$;

-- ───────────── Fotos (privater Bucket, Ordner = Haushalt) ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Rezeptfotos lesen" on storage.objects;
drop policy if exists "Rezeptfotos hochladen" on storage.objects;
drop policy if exists "Rezeptfotos ändern" on storage.objects;
drop policy if exists "Rezeptfotos löschen" on storage.objects;
create policy "Rezeptfotos lesen" on storage.objects for select to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = public.my_household_id()::text);
create policy "Rezeptfotos hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = public.my_household_id()::text);
create policy "Rezeptfotos ändern" on storage.objects for update to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = public.my_household_id()::text);
create policy "Rezeptfotos löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = public.my_household_id()::text);
