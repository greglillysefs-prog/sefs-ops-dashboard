-- SEFS Inventory Management accountability log
-- Run this in Supabase SQL Editor before employees use inventory-management.html.

create table if not exists public.inventory_change_logs (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid,
  inventory_item_name text not null,
  action_type text not null check (action_type in ('used', 'returned', 'adjust', 'set')),
  quantity_before numeric not null default 0,
  quantity_change numeric not null default 0,
  quantity_after numeric not null default 0,
  unit text,
  note text,
  changed_by_user_id uuid,
  changed_by_profile_id uuid,
  changed_by_name text,
  changed_by_email text,
  device_info text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_change_logs_item_idx
  on public.inventory_change_logs (inventory_item_id);

create index if not exists inventory_change_logs_created_at_idx
  on public.inventory_change_logs (created_at desc);

alter table public.inventory_change_logs enable row level security;

grant select, insert on public.inventory_change_logs to authenticated;
grant select on public.inventory_change_logs to anon;

drop policy if exists "inventory logs authenticated insert" on public.inventory_change_logs;
create policy "inventory logs authenticated insert"
  on public.inventory_change_logs
  for insert
  to authenticated
  with check ((select auth.uid()) = changed_by_user_id);

drop policy if exists "inventory logs authenticated read" on public.inventory_change_logs;
create policy "inventory logs authenticated read"
  on public.inventory_change_logs
  for select
  to authenticated
  using (true);

-- The main dashboard is currently a public static page, so it needs anon read
-- access to show inventory accountability logs on the dashboard.
drop policy if exists "inventory logs dashboard read" on public.inventory_change_logs;
create policy "inventory logs dashboard read"
  on public.inventory_change_logs
  for select
  to anon
  using (true);

-- The locked inventory page signs in with the same Supabase Auth users as the
-- employee portal. These policies only matter if RLS is enabled on inventory_items.
grant select, update on public.inventory_items to authenticated;

drop policy if exists "inventory authenticated read" on public.inventory_items;
create policy "inventory authenticated read"
  on public.inventory_items
  for select
  to authenticated
  using (true);

drop policy if exists "inventory authenticated update" on public.inventory_items;
create policy "inventory authenticated update"
  on public.inventory_items
  for update
  to authenticated
  using (true)
  with check (true);
