create extension if not exists pgcrypto;

-- ─── profiles ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  gender text not null default 'Woman',
  height text,
  body_shape text,
  skin_tone text,
  style_preferences text[] not null default '{}',
  occasion_preference text not null default 'office-heavy',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can insert their own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- ─── wardrobe_items ───────────────────────────────────────────────────────────

create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  category text not null,
  subcategory text not null,
  fit text not null,
  sleeve text,
  colours text[] not null default '{}',
  pattern text not null,
  seasons text[] not null default '{}',
  occasions text[] not null default '{}',
  formality text not null,
  material text not null,
  last_worn_days_ago integer not null default 0,
  wear_count integer not null default 0,
  favorite boolean not null default false,
  image_url text,
  image_storage_path text,
  ai_status text not null default 'idle',
  ai_confidence numeric,
  ai_summary text,
  ai_tags jsonb,
  is_dirty boolean not null default false,
  purchase_price numeric,
  purchase_date date,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.wardrobe_items
  add column if not exists ai_status text not null default 'idle',
  add column if not exists ai_confidence numeric,
  add column if not exists ai_summary text,
  add column if not exists ai_tags jsonb,
  add column if not exists is_dirty boolean not null default false,
  add column if not exists purchase_price numeric,
  add column if not exists purchase_date date;

alter table public.wardrobe_items enable row level security;

create policy "Users can view their own wardrobe items"
on public.wardrobe_items
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own wardrobe items"
on public.wardrobe_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own wardrobe items"
on public.wardrobe_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own wardrobe items"
on public.wardrobe_items
for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('wardrobe-images', 'wardrobe-images', false)
on conflict (id) do nothing;

create policy "Users can view their own wardrobe images"
on storage.objects
for select
to authenticated
using (bucket_id = 'wardrobe-images' and owner = (select auth.uid()));

create policy "Users can upload their own wardrobe images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'wardrobe-images' and owner = (select auth.uid()));

create policy "Users can update their own wardrobe images"
on storage.objects
for update
to authenticated
using (bucket_id = 'wardrobe-images' and owner = (select auth.uid()))
with check (bucket_id = 'wardrobe-images' and owner = (select auth.uid()));

create policy "Users can delete their own wardrobe images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'wardrobe-images' and owner = (select auth.uid()));

-- ─── outfit_logs ──────────────────────────────────────────────────────────────
-- Stores one row per "Mark as Worn" event.
--
-- Column guide:
--   item_ids        — ordered UUID array; outfit_key is a deterministic
--                     fingerprint used for O(1) repeat-detection.
--   item_snapshot   — slim copy of each item's attributes at wear-time.
--                     Keeps calendar / AI context intact even after items are
--                     deleted.  Shape: [{id,name,category,colours,formality,
--                     imageUrl}]
--   color_palette   — deduped union of all item colours; drives analytics
--                     ("most worn palettes") without re-joining wardrobe_items.
--   formality       — dominant formality level of the outfit; enables
--                     analytics queries ("how often do I dress smart?") and
--                     lets the AI learn style patterns over time.
--   weather_condition / location_name — captured at log time so the AI can
--                     correlate outfit choices with weather without an API
--                     call on read-back.

create table if not exists public.outfit_logs (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  worn_date         date        not null default current_date,
  item_ids          text[]      not null,
  -- canonical fingerprint: sorted item_ids joined with '|' for O(1) dupe lookup
  -- populated by the client: itemIds.sort().join('|')
  outfit_key        text        not null,
  occasion          text,
  temperature_c     integer,
  weather_condition text,
  location_name     text,
  -- slim JSON snapshot of each item's key attributes at wear-time
  item_snapshot     jsonb       not null default '[]',
  -- deduped colour list across all worn items
  color_palette     text[]      not null default '{}',
  -- dominant formality of the outfit: casual|smart|formal|festive|athleisure
  formality         text,
  notes             text,
  -- 1 (hate) … 3 (neutral) … 5 (love).  NULL = not yet rated.
  rating            smallint    check (rating between 1 and 5),
  rating_note       text,
  created_at        timestamptz not null default timezone('utc', now())
);

-- ─── Migration: add new columns to any existing outfit_logs table ─────────────
alter table public.outfit_logs
  add column if not exists rating            smallint check (rating between 1 and 5),
  add column if not exists rating_note       text,
  add column if not exists weather_condition text,
  add column if not exists location_name     text,
  add column if not exists item_snapshot     jsonb    not null default '[]',
  add column if not exists color_palette     text[]   not null default '{}',
  add column if not exists formality         text;

-- Fast calendar month queries and reverse-chron feed
create index if not exists outfit_logs_user_date_idx
  on public.outfit_logs (user_id, worn_date desc);

-- Fast repeat-detection: find the same outfit_key within a date range
create index if not exists outfit_logs_user_key_idx
  on public.outfit_logs (user_id, outfit_key, worn_date desc);

-- Top-rated query: find highest-rated outfit combos quickly
create index if not exists outfit_logs_user_rating_idx
  on public.outfit_logs (user_id, rating desc)
  where rating is not null;

-- Analytics: group by formality / weather
create index if not exists outfit_logs_user_formality_idx
  on public.outfit_logs (user_id, formality)
  where formality is not null;

alter table public.outfit_logs enable row level security;

create policy "Users can view their own outfit logs"
  on public.outfit_logs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own outfit logs"
  on public.outfit_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own outfit logs"
  on public.outfit_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own outfit logs"
  on public.outfit_logs for delete to authenticated
  using ((select auth.uid()) = user_id);
