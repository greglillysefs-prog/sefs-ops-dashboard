

-- ============================================================
-- V7 Quote workflow tables
-- Safe additive setup: does not drop/delete existing data.
-- ============================================================

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  job_id uuid,
  customer text,
  phone text,
  email text,
  address text,
  quote_name text,
  status text not null default 'Draft',
  system_type text,
  square_feet numeric default 0,
  cove_lf numeric default 0,
  sale_price numeric default 0,
  material_cost numeric default 0,
  labor_cost numeric default 0,
  other_cost numeric default 0,
  quote_json jsonb,
  notes text,
  created_at timestamptz default now()
);

create table if not exists quote_systems (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  active boolean not null default true,
  description text,
  default_waste_percent numeric not null default 5,
  created_at timestamptz default now()
);

create table if not exists quote_system_options (
  id uuid primary key default gen_random_uuid(),
  system_id uuid references quote_systems(id) on delete cascade,
  name text not null,
  option_group text,
  value text,
  numeric_value numeric,
  is_default boolean default false,
  notes text,
  created_at timestamptz default now()
);

create table if not exists quote_system_materials (
  id uuid primary key default gen_random_uuid(),
  system_id uuid references quote_systems(id) on delete cascade,
  material_name text not null,
  inventory_item_id uuid,
  calc_basis text not null default 'sqft',
  coverage numeric,
  unit text not null default 'each',
  multiplier numeric not null default 1,
  round_up boolean not null default true,
  layer_name text,
  option_filter text,
  notes text,
  sort_order numeric default 0,
  created_at timestamptz default now()
);

alter table leads add column if not exists converted_quote_id uuid;
alter table leads add column if not exists converted_job_id uuid;
alter table jobs add column if not exists source_quote_id uuid;
alter table jobs add column if not exists quote_json jsonb;
alter table jobs add column if not exists quote_status text default 'Draft';

insert into quote_systems (name, category, description, default_waste_percent)
values
('Flake', 'Resinous', 'Primer, polyaspartic, flake broadcast, topcoat', 5),
('Metallic', 'Resinous', 'Primer, XR metallic coat, metallic powder, topcoat', 5),
('Prime & Coat', 'Resinous', 'Primer and clear/color topcoat', 5),
('Mortar / Prime / Coat', 'Mortar', 'Epoxy mortar system with primer and topcoat', 5),
('Quartz', 'Resinous', 'Primer, quartz broadcast, topcoat', 5),
('Wood / Stone Overlay Interior', 'Overlay', 'Interior overlay system with stain and sealer', 5),
('Wood / Stone Overlay Exterior', 'Overlay', 'Exterior overlay system with stain and acrylic sealer', 5),
('Broom Overlay', 'Overlay', 'Broom finish overlay system', 5),
('Grind / Stain / Seal Interior', 'Concrete', 'Interior grind, stain, and urethane seal', 5),
('Grind / Stain / Seal Exterior', 'Concrete', 'Exterior grind, stain, and acrylic seal', 5),
('Polish', 'Concrete', 'Polished concrete system', 5),
('Prep Only', 'Prep', 'Surface preparation only', 5)
on conflict (name) do nothing;
