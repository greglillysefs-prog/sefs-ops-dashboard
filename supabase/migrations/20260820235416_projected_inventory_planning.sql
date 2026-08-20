alter table public.jobs
  add column if not exists custom_materials jsonb default '[]'::jsonb;

alter table public.inventory_items
  add column if not exists tracked_quantity boolean default true;

update public.inventory_items
set tracked_quantity = true
where tracked_quantity is null;

create table if not exists public.incoming_inventory (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text,
  qty numeric default 0,
  unit text,
  vendor_name text,
  order_date date default current_date,
  expected_date date,
  status text default 'Ordered',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.incoming_inventory
  add column if not exists inventory_item_id uuid,
  add column if not exists item_name text,
  add column if not exists qty numeric default 0,
  add column if not exists unit text,
  add column if not exists vendor_name text,
  add column if not exists order_date date default current_date,
  add column if not exists expected_date date,
  add column if not exists status text default 'Ordered',
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists incoming_inventory_inventory_item_id_idx
  on public.incoming_inventory(inventory_item_id);

create index if not exists incoming_inventory_expected_date_idx
  on public.incoming_inventory(expected_date);

create index if not exists incoming_inventory_status_idx
  on public.incoming_inventory(status);

alter table public.incoming_inventory enable row level security;

drop policy if exists "Allow dashboard incoming inventory access"
  on public.incoming_inventory;

create policy "Allow dashboard incoming inventory access"
  on public.incoming_inventory
  for all
  to public
  using (true)
  with check (true);

grant select, insert, update, delete on public.incoming_inventory to anon, authenticated;
