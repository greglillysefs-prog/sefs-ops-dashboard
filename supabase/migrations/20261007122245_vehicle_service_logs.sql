-- Add per-vehicle service history while retaining the existing vehicle summary
-- fields used by the dashboard.

alter table public.vehicles
  add column if not exists updated_at timestamptz not null default now();

alter table public.vehicles
  drop constraint if exists vehicles_mileage_nonnegative,
  add constraint vehicles_mileage_nonnegative check (mileage is null or mileage >= 0);

create table if not exists public.vehicle_service_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  service_date date not null default current_date,
  service_type text not null default 'Routine Service',
  mileage numeric(14,1),
  description text,
  notes text,
  performed_by text,
  next_service_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_service_logs_mileage_nonnegative
    check (mileage is null or mileage >= 0),
  constraint vehicle_service_logs_type_check
    check (service_type in (
      'Routine Service',
      'Oil Change',
      'Tires',
      'Repair',
      'Inspection',
      'Registration',
      'Other'
    ))
);

create index if not exists vehicle_service_logs_vehicle_date_idx
  on public.vehicle_service_logs(vehicle_id, service_date desc, created_at desc);

alter table public.vehicles enable row level security;
alter table public.vehicle_service_logs enable row level security;

revoke all on table public.vehicles from anon, authenticated;
revoke all on table public.vehicle_service_logs from anon, authenticated;

grant select, insert, update, delete on table public.vehicles to authenticated;
grant select, insert, update, delete on table public.vehicle_service_logs to authenticated;
grant select, insert, update, delete on table public.vehicles to service_role;
grant select, insert, update, delete on table public.vehicle_service_logs to service_role;

revoke execute on function public.is_sefs_manager() from public, anon;
grant execute on function public.is_sefs_manager() to authenticated, service_role;

drop policy if exists "vehicle managers select" on public.vehicles;
create policy "vehicle managers select"
on public.vehicles for select
to authenticated
using (public.is_sefs_manager());

drop policy if exists "vehicle managers insert" on public.vehicles;
create policy "vehicle managers insert"
on public.vehicles for insert
to authenticated
with check (public.is_sefs_manager());

drop policy if exists "vehicle managers update" on public.vehicles;
create policy "vehicle managers update"
on public.vehicles for update
to authenticated
using (public.is_sefs_manager())
with check (public.is_sefs_manager());

drop policy if exists "vehicle managers delete" on public.vehicles;
create policy "vehicle managers delete"
on public.vehicles for delete
to authenticated
using (public.is_sefs_manager());

drop policy if exists "vehicle log managers select" on public.vehicle_service_logs;
create policy "vehicle log managers select"
on public.vehicle_service_logs for select
to authenticated
using (public.is_sefs_manager());

drop policy if exists "vehicle log managers insert" on public.vehicle_service_logs;
create policy "vehicle log managers insert"
on public.vehicle_service_logs for insert
to authenticated
with check (public.is_sefs_manager());

drop policy if exists "vehicle log managers update" on public.vehicle_service_logs;
create policy "vehicle log managers update"
on public.vehicle_service_logs for update
to authenticated
using (public.is_sefs_manager())
with check (public.is_sefs_manager());

drop policy if exists "vehicle log managers delete" on public.vehicle_service_logs;
create policy "vehicle log managers delete"
on public.vehicle_service_logs for delete
to authenticated
using (public.is_sefs_manager());
