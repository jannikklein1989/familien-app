-- KK Home · Rezepte: Geräte, Portionen, Zubereitung (für Geräte-Reiter und KI-Import)
alter table recipes add column if not exists appliances text[] not null default '{}';
alter table recipes add column if not exists servings int;
alter table recipes add column if not exists steps text; -- ein Schritt pro Zeile
