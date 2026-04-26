create extension if not exists pgcrypto;

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
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.wardrobe_items
  add column if not exists ai_status text not null default 'idle',
  add column if not exists ai_confidence numeric,
  add column if not exists ai_summary text,
  add column if not exists ai_tags jsonb;

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
