-- SEFS Inventory variants
-- Run this in Supabase SQL Editor to track colors, sizes, finishes, and active/inactive variants under inventory items.

alter table public.inventory_items
  add column if not exists track_variants boolean default false;

create table if not exists public.inventory_item_variants (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid references public.inventory_items(id) on delete cascade,
  variant_name text not null,
  variant_type text default 'Color',
  color text,
  size text,
  unit text default 'each',
  qty numeric default 0,
  min_qty numeric default 0,
  cost numeric default 0,
  tracked_quantity boolean default true,
  active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.inventory_item_variants add column if not exists inventory_item_id uuid references public.inventory_items(id) on delete cascade;
alter table public.inventory_item_variants add column if not exists variant_name text;
alter table public.inventory_item_variants add column if not exists variant_type text default 'Color';
alter table public.inventory_item_variants add column if not exists color text;
alter table public.inventory_item_variants add column if not exists size text;
alter table public.inventory_item_variants add column if not exists unit text default 'each';
alter table public.inventory_item_variants add column if not exists qty numeric default 0;
alter table public.inventory_item_variants add column if not exists min_qty numeric default 0;
alter table public.inventory_item_variants add column if not exists cost numeric default 0;
alter table public.inventory_item_variants add column if not exists tracked_quantity boolean default true;
alter table public.inventory_item_variants add column if not exists active boolean default true;
alter table public.inventory_item_variants add column if not exists notes text;
alter table public.inventory_item_variants add column if not exists created_at timestamptz default now();
alter table public.inventory_item_variants add column if not exists updated_at timestamptz default now();

create index if not exists inventory_item_variants_item_idx
  on public.inventory_item_variants (inventory_item_id);

create index if not exists inventory_item_variants_active_idx
  on public.inventory_item_variants (active);

alter table public.inventory_item_variants enable row level security;

grant select, insert, update, delete on public.inventory_item_variants to anon;
grant select, insert, update, delete on public.inventory_item_variants to authenticated;
grant select, update on public.inventory_items to authenticated;
grant select, update on public.inventory_items to anon;

drop policy if exists "inventory variants dashboard read" on public.inventory_item_variants;
create policy "inventory variants dashboard read"
  on public.inventory_item_variants
  for select
  to anon, authenticated
  using (true);

drop policy if exists "inventory variants dashboard write" on public.inventory_item_variants;
create policy "inventory variants dashboard write"
  on public.inventory_item_variants
  for all
  to anon, authenticated
  using (true)
  with check (true);
