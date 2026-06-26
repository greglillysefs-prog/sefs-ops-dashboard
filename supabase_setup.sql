
create extension if not exists pgcrypto;

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null default '2026-07-01',
  active boolean not null default true,
  notes text,
  created_at timestamptz default now()
);
alter table employees add column if not exists name text;
alter table employees add column if not exists start_date date default '2026-07-01';
alter table employees add column if not exists active boolean default true;
alter table employees add column if not exists notes text;
alter table employees add column if not exists created_at timestamptz default now();

create table if not exists personal_time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  entry_type text not null default 'used',
  hours numeric not null default 0,
  date_used date not null default current_date,
  manager text,
  notes text,
  created_at timestamptz default now()
);
alter table personal_time_entries add column if not exists employee_id uuid;
alter table personal_time_entries add column if not exists entry_type text default 'used';
alter table personal_time_entries add column if not exists hours numeric default 0;
alter table personal_time_entries add column if not exists date_used date default current_date;
alter table personal_time_entries add column if not exists manager text;
alter table personal_time_entries add column if not exists notes text;
alter table personal_time_entries add column if not exists created_at timestamptz default now();

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  phone text,
  email text,
  address text,
  stage text not null default 'New Lead',
  next_followup date,
  estimated_value numeric default 0,
  notes text,
  created_at timestamptz default now()
);
alter table leads add column if not exists customer text;
alter table leads add column if not exists phone text;
alter table leads add column if not exists email text;
alter table leads add column if not exists address text;
alter table leads add column if not exists stage text default 'New Lead';
alter table leads add column if not exists next_followup date;
alter table leads add column if not exists estimated_value numeric default 0;
alter table leads add column if not exists notes text;
alter table leads add column if not exists created_at timestamptz default now();

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  job_name text,
  address text,
  system_type text,
  square_feet numeric default 0,
  cove_lf numeric default 0,
  status text not null default 'Scheduled',
  start_date date,
  end_date date,
  crew text,
  sale_price numeric default 0,
  material_cost numeric default 0,
  labor_cost numeric default 0,
  other_cost numeric default 0,
  notes text,
  source_lead_id uuid,
  created_at timestamptz default now()
);
alter table jobs add column if not exists customer text;
alter table jobs add column if not exists job_name text;
alter table jobs add column if not exists address text;
alter table jobs add column if not exists system_type text;
alter table jobs add column if not exists square_feet numeric default 0;
alter table jobs add column if not exists cove_lf numeric default 0;
alter table jobs add column if not exists status text default 'Scheduled';
alter table jobs add column if not exists start_date date;
alter table jobs add column if not exists end_date date;
alter table jobs add column if not exists crew text;
alter table jobs add column if not exists sale_price numeric default 0;
alter table jobs add column if not exists material_cost numeric default 0;
alter table jobs add column if not exists labor_cost numeric default 0;
alter table jobs add column if not exists other_cost numeric default 0;
alter table jobs add column if not exists notes text;
alter table jobs add column if not exists source_lead_id uuid;
alter table jobs add column if not exists created_at timestamptz default now();

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(), name text not null, category text, unit text not null default 'each', qty numeric not null default 0, min_qty numeric not null default 0, cost numeric default 0, notes text, created_at timestamptz default now()
);
alter table inventory_items add column if not exists name text;
alter table inventory_items add column if not exists category text;
alter table inventory_items add column if not exists unit text default 'each';
alter table inventory_items add column if not exists qty numeric default 0;
alter table inventory_items add column if not exists min_qty numeric default 0;
alter table inventory_items add column if not exists cost numeric default 0;
alter table inventory_items add column if not exists notes text;
alter table inventory_items add column if not exists created_at timestamptz default now();

create table if not exists equipment_items (id uuid primary key default gen_random_uuid(), name text not null, category text, status text not null default 'Available', assigned_to text, job_id uuid, due_back date, notes text, created_at timestamptz default now());
alter table equipment_items add column if not exists name text;
alter table equipment_items add column if not exists category text;
alter table equipment_items add column if not exists status text default 'Available';
alter table equipment_items add column if not exists assigned_to text;
alter table equipment_items add column if not exists job_id uuid;
alter table equipment_items add column if not exists due_back date;
alter table equipment_items add column if not exists notes text;
alter table equipment_items add column if not exists created_at timestamptz default now();

create table if not exists vehicles (id uuid primary key default gen_random_uuid(), name text not null, mileage numeric default 0, last_service date, next_service date, notes text, created_at timestamptz default now());
alter table vehicles add column if not exists name text;
alter table vehicles add column if not exists mileage numeric default 0;
alter table vehicles add column if not exists last_service date;
alter table vehicles add column if not exists next_service date;
alter table vehicles add column if not exists notes text;
alter table vehicles add column if not exists created_at timestamptz default now();

create table if not exists inspections (id uuid primary key default gen_random_uuid(), job_id uuid, inspector text, inspection_date date not null default current_date, surface_prep boolean default false, moisture_tested boolean default false, profile_achieved boolean default false, primer_applied boolean default false, broadcast_complete boolean default false, topcoat_complete boolean default false, notes text, created_at timestamptz default now());
alter table inspections add column if not exists job_id uuid;
alter table inspections add column if not exists inspector text;
alter table inspections add column if not exists inspection_date date default current_date;
alter table inspections add column if not exists surface_prep boolean default false;
alter table inspections add column if not exists moisture_tested boolean default false;
alter table inspections add column if not exists profile_achieved boolean default false;
alter table inspections add column if not exists primer_applied boolean default false;
alter table inspections add column if not exists broadcast_complete boolean default false;
alter table inspections add column if not exists topcoat_complete boolean default false;
alter table inspections add column if not exists notes text;
alter table inspections add column if not exists created_at timestamptz default now();

create table if not exists callbacks (id uuid primary key default gen_random_uuid(), job_id uuid, issue_date date not null default current_date, warranty_until date, issue text, status text not null default 'Open', resolution text, created_at timestamptz default now());
alter table callbacks add column if not exists job_id uuid;
alter table callbacks add column if not exists issue_date date default current_date;
alter table callbacks add column if not exists warranty_until date;
alter table callbacks add column if not exists issue text;
alter table callbacks add column if not exists status text default 'Open';
alter table callbacks add column if not exists resolution text;
alter table callbacks add column if not exists created_at timestamptz default now();

create table if not exists photo_attachments (id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id uuid not null, file_name text not null, storage_path text not null, public_url text, caption text, uploaded_by text, created_at timestamptz default now());
alter table photo_attachments add column if not exists entity_type text;
alter table photo_attachments add column if not exists entity_id uuid;
alter table photo_attachments add column if not exists file_name text;
alter table photo_attachments add column if not exists storage_path text;
alter table photo_attachments add column if not exists public_url text;
alter table photo_attachments add column if not exists caption text;
alter table photo_attachments add column if not exists uploaded_by text;
alter table photo_attachments add column if not exists created_at timestamptz default now();

insert into storage.buckets (id, name, public) values ('sefs-photos','sefs-photos',true) on conflict (id) do update set public = true;
do $$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='SEFS photos public read') then create policy "SEFS photos public read" on storage.objects for select using (bucket_id='sefs-photos'); end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='SEFS photos public upload') then create policy "SEFS photos public upload" on storage.objects for insert with check (bucket_id='sefs-photos'); end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='SEFS photos public delete') then create policy "SEFS photos public delete" on storage.objects for delete using (bucket_id='sefs-photos'); end if; end $$;

insert into employees (name, start_date) select 'Rhett W.', '2026-07-01' where not exists (select 1 from employees where name='Rhett W.');
insert into employees (name, start_date) select 'Tyler C.', '2026-07-01' where not exists (select 1 from employees where name='Tyler C.');
insert into employees (name, start_date) select 'Alex H.', '2026-07-01' where not exists (select 1 from employees where name='Alex H.');

insert into inventory_items (name,category,unit,qty,min_qty,cost)
select * from (values
('Primer 3G Kit','Coatings','kit',0,2,170),('XR Epoxy 3G Kit','Coatings','kit',0,2,130),('Polyurea 2G Kit','Coatings','kit',0,2,210),('WB Urethane 3G Kit','Coatings','kit',0,1,305),('WB Epoxy 2G Kit','Coatings','kit',0,1,145),('Aliphatic 3G Kit','Coatings','kit',0,1,305),('20-40 Silica Sand','Broadcast','bag',0,10,15),('Flake Box','Broadcast','box',0,3,175),('Quartz Bag','Broadcast','bag',0,5,20),('Metallic Powder Jar','Pigment','jar',0,2,48),('Color Pod','Pigment','pod',0,5,35),('Overlay Mortar Bag','Overlay','bag',0,10,20),('Stain 32 oz','Stain','bottle',0,2,65),('Cove Mortar Kit','Cove','kit',0,2,55),('Low Luster Acrylic Gal','Topcoat','gal',0,2,120),('Gloss Acrylic Gal','Topcoat','gal',0,2,140)
) as v(name,category,unit,qty,min_qty,cost) where not exists (select 1 from inventory_items i where i.name=v.name);


-- Editable system recipes for pull sheets
create table if not exists system_recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  default_waste_percent numeric default 5,
  default_crew_size numeric default 2,
  default_labor_days numeric default 1,
  labor_notes text,
  active boolean not null default true,
  sort_order numeric default 0,
  created_at timestamptz default now()
);

create table if not exists system_recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references system_recipes(id) on delete cascade,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  material_name text,
  unit text default 'each',
  basis text not null default 'sqft', -- sqft, linear_feet, fixed
  coverage_rate numeric default 0,
  fixed_qty numeric default 0,
  waste_factor numeric default 1,
  sort_order numeric default 0,
  notes text,
  created_at timestamptz default now()
);

alter table system_recipes add column if not exists description text;
alter table system_recipes add column if not exists default_waste_percent numeric default 5;
alter table system_recipes add column if not exists default_crew_size numeric default 2;
alter table system_recipes add column if not exists default_labor_days numeric default 1;
alter table system_recipes add column if not exists labor_notes text;
alter table system_recipes add column if not exists active boolean default true;
alter table system_recipes add column if not exists sort_order numeric default 0;
alter table system_recipes add column if not exists created_at timestamptz default now();

alter table system_recipe_items add column if not exists recipe_id uuid;
alter table system_recipe_items add column if not exists inventory_item_id uuid;
alter table system_recipe_items add column if not exists material_name text;
alter table system_recipe_items add column if not exists unit text default 'each';
alter table system_recipe_items add column if not exists basis text default 'sqft';
alter table system_recipe_items add column if not exists coverage_rate numeric default 0;
alter table system_recipe_items add column if not exists fixed_qty numeric default 0;
alter table system_recipe_items add column if not exists waste_factor numeric default 1;
alter table system_recipe_items add column if not exists sort_order numeric default 0;
alter table system_recipe_items add column if not exists notes text;
alter table system_recipe_items add column if not exists created_at timestamptz default now();

insert into system_recipes (name, description, default_waste_percent, active, sort_order)
select * from (values
('Flake','Primer, broadcast sand/flake, polyurea topcoat',5,true,10),
('Metallic','Primer, metallic body coat, topcoat, metallic powder',5,true,20),
('Quartz','Primer, quartz broadcast, polyurea topcoat',5,true,30),
('Mortar','Primer, sand/mortar build, epoxy topcoat',5,true,40),
('Wood/Stone Overlay','Overlay mortar, stain, acrylic sealer',5,true,50),
('Broom Overlay','Broom overlay mortar and acrylic sealer',5,true,60),
('Grind/Stain/Seal','Stain and urethane sealer',5,true,70),
('Prep Only','Consumables/tooling allowance only',5,true,80)
) as v(name, description, default_waste_percent, active, sort_order)
where not exists (select 1 from system_recipes r where r.name = v.name);

update system_recipes r set
  default_crew_size = v.default_crew_size,
  default_labor_days = v.default_labor_days
from (values
('Flake',3,2),
('Metallic',3,3),
('Quartz',3,2),
('Mortar',4,3),
('Wood/Stone Overlay',3,3),
('Broom Overlay',3,1),
('Grind/Stain/Seal',3,3),
('Prep Only',2,1)
) as v(name, default_crew_size, default_labor_days)
where r.name = v.name
  and (r.default_crew_size is null or r.default_crew_size = 2)
  and (r.default_labor_days is null or r.default_labor_days = 1);

-- Seed default material recipes only when each system has no materials yet.
do $$
declare
  flake uuid; metallic uuid; quartz uuid; mortar uuid; wood uuid; broom uuid; gss uuid; prep uuid;
begin
  select id into flake from system_recipes where name='Flake';
  select id into metallic from system_recipes where name='Metallic';
  select id into quartz from system_recipes where name='Quartz';
  select id into mortar from system_recipes where name='Mortar';
  select id into wood from system_recipes where name='Wood/Stone Overlay';
  select id into broom from system_recipes where name='Broom Overlay';
  select id into gss from system_recipes where name='Grind/Stain/Seal';
  select id into prep from system_recipes where name='Prep Only';

  if flake is not null and not exists (select 1 from system_recipe_items where recipe_id=flake) then
    insert into system_recipe_items (recipe_id, material_name, unit, basis, coverage_rate, sort_order) values
    (flake,'Primer 3G Kit','kits','sqft',500,10),
    (flake,'Polyurea 2G Kit','kits','sqft',250,20),
    (flake,'Flake Box','boxes','sqft',280,30),
    (flake,'20-40 Silica Sand','bags','sqft',200,40),
    (flake,'Cove Mortar Kit','kits','linear_feet',25,50);
  end if;

  if metallic is not null and not exists (select 1 from system_recipe_items where recipe_id=metallic) then
    insert into system_recipe_items (recipe_id, material_name, unit, basis, coverage_rate, sort_order) values
    (metallic,'Primer 3G Kit','kits','sqft',500,10),
    (metallic,'XR Epoxy 3G Kit - Metallic Coat','kits','sqft',100,20),
    (metallic,'XR Epoxy 3G Kit - Topcoat','kits','sqft',500,30),
    (metallic,'Metallic Powder Jar','jars','sqft',200,40),
    (metallic,'Cove Mortar Kit','kits','linear_feet',25,50);
  end if;

  if quartz is not null and not exists (select 1 from system_recipe_items where recipe_id=quartz) then
    insert into system_recipe_items (recipe_id, material_name, unit, basis, coverage_rate, sort_order) values
    (quartz,'Primer 3G Kit','kits','sqft',500,10),
    (quartz,'Polyurea 2G Kit','kits','sqft',250,20),
    (quartz,'Quartz Bag','bags','sqft',150,30),
    (quartz,'Cove Mortar Kit','kits','linear_feet',25,40);
  end if;

  if mortar is not null and not exists (select 1 from system_recipe_items where recipe_id=mortar) then
    insert into system_recipe_items (recipe_id, material_name, unit, basis, coverage_rate, sort_order) values
    (mortar,'Primer 3G Kit','kits','sqft',500,10),
    (mortar,'20-40 Silica Sand','bags','sqft',200,20),
    (mortar,'XR Epoxy 3G Kit','kits','sqft',500,30),
    (mortar,'Cove Mortar Kit','kits','linear_feet',25,40);
  end if;

  if wood is not null and not exists (select 1 from system_recipe_items where recipe_id=wood) then
    insert into system_recipe_items (recipe_id, material_name, unit, basis, coverage_rate, sort_order) values
    (wood,'Overlay Mortar Bag','bags','sqft',100,10),
    (wood,'Stain 32 oz','bottles','sqft',500,20),
    (wood,'Low Luster Acrylic Gal','gal','sqft',500,30);
  end if;

  if broom is not null and not exists (select 1 from system_recipe_items where recipe_id=broom) then
    insert into system_recipe_items (recipe_id, material_name, unit, basis, coverage_rate, sort_order) values
    (broom,'Overlay Mortar Bag','bags','sqft',180,10),
    (broom,'Gloss Acrylic Gal','gal','sqft',400,20);
  end if;

  if gss is not null and not exists (select 1 from system_recipe_items where recipe_id=gss) then
    insert into system_recipe_items (recipe_id, material_name, unit, basis, coverage_rate, sort_order) values
    (gss,'Stain 32 oz','bottles','sqft',1000,10),
    (gss,'WB Urethane 3G Kit','kits','sqft',2500,20);
  end if;

  if prep is not null and not exists (select 1 from system_recipe_items where recipe_id=prep) then
    insert into system_recipe_items (recipe_id, material_name, unit, basis, coverage_rate, sort_order) values
    (prep,'Consumables / Tooling Allowance','allowance units','sqft',1000,10);
  end if;
end $$;


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
