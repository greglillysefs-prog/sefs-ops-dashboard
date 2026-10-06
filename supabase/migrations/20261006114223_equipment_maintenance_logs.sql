-- Convert the dashboard equipment area from checkout tracking to machine
-- usage and maintenance history without removing legacy equipment columns.

alter table public.equipment_items
  add column if not exists meter_type text not null default 'Hours',
  add column if not exists current_hours numeric(12,1) not null default 0,
  add column if not exists current_miles numeric(14,1) not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.equipment_items
  alter column status set default 'Active';

update public.equipment_items
set status = case
  when status in ('Available', 'Checked Out') then 'Active'
  when status = 'In Repair' then 'Needs Service'
  when status = 'Missing' then 'Out of Service'
  else coalesce(nullif(status, ''), 'Active')
end;

alter table public.equipment_items
  drop constraint if exists equipment_items_current_hours_nonnegative,
  add constraint equipment_items_current_hours_nonnegative check (current_hours >= 0),
  drop constraint if exists equipment_items_current_miles_nonnegative,
  add constraint equipment_items_current_miles_nonnegative check (current_miles >= 0),
  drop constraint if exists equipment_items_meter_type_check,
  add constraint equipment_items_meter_type_check
    check (meter_type in ('Hours', 'Miles', 'Hours & Miles', 'None'));

create table if not exists public.equipment_maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment_items(id) on delete cascade,
  entry_date date not null default current_date,
  entry_type text not null default 'Routine Maintenance',
  hours numeric(12,1),
  miles numeric(14,1),
  description text,
  performed_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_maintenance_logs_hours_nonnegative check (hours is null or hours >= 0),
  constraint equipment_maintenance_logs_miles_nonnegative check (miles is null or miles >= 0),
  constraint equipment_maintenance_logs_entry_type_check
    check (entry_type in ('Usage Update', 'Routine Maintenance', 'Repair', 'Inspection', 'Other'))
);

create index if not exists equipment_maintenance_logs_equipment_date_idx
  on public.equipment_maintenance_logs(equipment_id, entry_date desc, created_at desc);

alter table public.equipment_items enable row level security;
alter table public.equipment_maintenance_logs enable row level security;

revoke all on table public.equipment_items from anon, authenticated;
revoke all on table public.equipment_maintenance_logs from anon, authenticated;

grant select, insert, update, delete on table public.equipment_items to authenticated;
grant select, insert, update, delete on table public.equipment_maintenance_logs to authenticated;
grant select, insert, update, delete on table public.equipment_items to service_role;
grant select, insert, update, delete on table public.equipment_maintenance_logs to service_role;

revoke execute on function public.is_sefs_manager() from public, anon;
grant execute on function public.is_sefs_manager() to authenticated, service_role;

drop policy if exists "equipment managers select" on public.equipment_items;
create policy "equipment managers select"
on public.equipment_items for select
to authenticated
using (public.is_sefs_manager());

drop policy if exists "equipment managers insert" on public.equipment_items;
create policy "equipment managers insert"
on public.equipment_items for insert
to authenticated
with check (public.is_sefs_manager());

drop policy if exists "equipment managers update" on public.equipment_items;
create policy "equipment managers update"
on public.equipment_items for update
to authenticated
using (public.is_sefs_manager())
with check (public.is_sefs_manager());

drop policy if exists "equipment managers delete" on public.equipment_items;
create policy "equipment managers delete"
on public.equipment_items for delete
to authenticated
using (public.is_sefs_manager());

drop policy if exists "equipment logs managers select" on public.equipment_maintenance_logs;
create policy "equipment logs managers select"
on public.equipment_maintenance_logs for select
to authenticated
using (public.is_sefs_manager());

drop policy if exists "equipment logs managers insert" on public.equipment_maintenance_logs;
create policy "equipment logs managers insert"
on public.equipment_maintenance_logs for insert
to authenticated
with check (public.is_sefs_manager());

drop policy if exists "equipment logs managers update" on public.equipment_maintenance_logs;
create policy "equipment logs managers update"
on public.equipment_maintenance_logs for update
to authenticated
using (public.is_sefs_manager())
with check (public.is_sefs_manager());

drop policy if exists "equipment logs managers delete" on public.equipment_maintenance_logs;
create policy "equipment logs managers delete"
on public.equipment_maintenance_logs for delete
to authenticated
using (public.is_sefs_manager());
