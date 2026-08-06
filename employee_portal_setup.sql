-- SEFS Employee Portal setup
-- Run this in Supabase SQL Editor after the existing dashboard schema.
-- This is additive and does not remove or rewrite existing dashboard tables.

create extension if not exists pgcrypto;

do $$ begin
  create type public.sefs_user_role as enum ('employee', 'crew_lead', 'manager', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.time_entry_status as enum ('draft', 'submitted', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  role public.sefs_user_role not null default 'employee',
  full_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists employee_id uuid references public.employees(id) on delete set null;
alter table public.profiles add column if not exists role public.sefs_user_role not null default 'employee';
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.employees add column if not exists hourly_rate numeric(10,2) not null default 0;

create table if not exists public.employee_job_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  assigned_role text,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  unique (employee_id, job_id)
);

alter table public.employee_job_assignments add column if not exists employee_id uuid references public.employees(id) on delete cascade;
alter table public.employee_job_assignments add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.employee_job_assignments add column if not exists assigned_role text;
alter table public.employee_job_assignments add column if not exists assigned_by uuid references auth.users(id) on delete set null;
alter table public.employee_job_assignments add column if not exists assigned_at timestamptz not null default now();
alter table public.employee_job_assignments add column if not exists notes text;
alter table public.employee_job_assignments add column if not exists created_at timestamptz not null default now();

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  job_id uuid references public.jobs(id) on delete set null,
  work_date date not null default current_date,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0,
  total_hours numeric(8,2) not null default 0,
  notes text,
  status public.time_entry_status not null default 'draft',
  submitted_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  device_info text,
  change_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.time_entries add column if not exists employee_id uuid references public.employees(id) on delete cascade;
alter table public.time_entries add column if not exists user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.time_entries add column if not exists job_id uuid references public.jobs(id) on delete set null;
alter table public.time_entries add column if not exists work_date date not null default current_date;
alter table public.time_entries add column if not exists start_time time;
alter table public.time_entries add column if not exists end_time time;
alter table public.time_entries add column if not exists break_minutes integer not null default 0;
alter table public.time_entries add column if not exists total_hours numeric(8,2) not null default 0;
alter table public.time_entries add column if not exists notes text;
alter table public.time_entries add column if not exists status public.time_entry_status not null default 'draft';
alter table public.time_entries add column if not exists submitted_at timestamptz;
alter table public.time_entries add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.time_entries add column if not exists approved_at timestamptz;
alter table public.time_entries add column if not exists rejected_by uuid references auth.users(id) on delete set null;
alter table public.time_entries add column if not exists rejected_at timestamptz;
alter table public.time_entries add column if not exists rejection_reason text;
alter table public.time_entries add column if not exists device_info text;
alter table public.time_entries add column if not exists change_reason text;
alter table public.time_entries add column if not exists created_at timestamptz not null default now();
alter table public.time_entries add column if not exists updated_at timestamptz not null default now();
alter table public.time_entries add column if not exists deleted_at timestamptz;

create table if not exists public.time_entry_audit_logs (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid references public.time_entries(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  previous_values jsonb,
  new_values jsonb,
  ip_address text,
  device_info text,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.time_entry_audit_logs add column if not exists time_entry_id uuid references public.time_entries(id) on delete set null;
alter table public.time_entry_audit_logs add column if not exists employee_id uuid references public.employees(id) on delete set null;
alter table public.time_entry_audit_logs add column if not exists actor_user_id uuid references auth.users(id) on delete set null;
alter table public.time_entry_audit_logs add column if not exists action_type text;
alter table public.time_entry_audit_logs add column if not exists previous_values jsonb;
alter table public.time_entry_audit_logs add column if not exists new_values jsonb;
alter table public.time_entry_audit_logs add column if not exists ip_address text;
alter table public.time_entry_audit_logs add column if not exists device_info text;
alter table public.time_entry_audit_logs add column if not exists reason text;
alter table public.time_entry_audit_logs add column if not exists created_at timestamptz not null default now();

create table if not exists public.pto_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  request_date date not null,
  hours numeric(8,2) not null default 0,
  notes text,
  status text not null default 'submitted',
  manager_id uuid references auth.users(id) on delete set null,
  manager_note text,
  decided_at timestamptz,
  personal_time_entry_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pto_requests add column if not exists time_entry_id uuid references public.time_entries(id) on delete set null;

create index if not exists profiles_employee_id_idx on public.profiles(employee_id);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists employee_job_assignments_employee_idx on public.employee_job_assignments(employee_id);
create index if not exists employee_job_assignments_job_idx on public.employee_job_assignments(job_id);
create index if not exists time_entries_employee_date_idx on public.time_entries(employee_id, work_date desc);
create index if not exists time_entries_user_idx on public.time_entries(user_id);
create index if not exists time_entries_job_idx on public.time_entries(job_id);
create index if not exists time_entries_status_idx on public.time_entries(status);
create index if not exists pto_requests_time_entry_id_idx on public.pto_requests(time_entry_id);
create index if not exists time_entry_audit_logs_entry_idx on public.time_entry_audit_logs(time_entry_id, created_at desc);

create or replace function public.current_profile_role()
returns public.sefs_user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employee_id
  from public.profiles
  where id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function public.is_sefs_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('manager', 'admin'), false)
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prepare_time_entry()
returns trigger
language plpgsql
as $$
declare
  raw_hours numeric;
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;

  raw_hours := extract(epoch from ((new.work_date + new.end_time) - (new.work_date + new.start_time))) / 3600.0;
  if raw_hours < 0 then
    raw_hours := raw_hours + 24;
  end if;

  new.total_hours = greatest(round((raw_hours - (coalesce(new.break_minutes, 0) / 60.0))::numeric, 2), 0);
  new.updated_at = now();

  if new.status = 'submitted' and new.submitted_at is null then
    new.submitted_at = now();
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'submitted' then
      new.submitted_at = now();
    elsif new.status = 'approved' then
      new.approved_at = now();
      new.approved_by = auth.uid();
    elsif new.status = 'rejected' then
      new.rejected_at = now();
      new.rejected_by = auth.uid();
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.audit_time_entry_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_label text;
  entry_id uuid;
  entry_employee_id uuid;
  device text;
  reason_text text;
begin
  if tg_op = 'INSERT' then
    action_label := case when new.status = 'submitted' then 'submitted' else 'created' end;
    entry_id := new.id;
    entry_employee_id := new.employee_id;
    device := new.device_info;
    reason_text := new.change_reason;
  elsif tg_op = 'UPDATE' then
    action_label := case
      when old.status is distinct from new.status then new.status::text
      when new.deleted_at is not null and old.deleted_at is null then 'deleted'
      else 'edited'
    end;
    entry_id := new.id;
    entry_employee_id := new.employee_id;
    device := coalesce(new.device_info, old.device_info);
    reason_text := coalesce(new.change_reason, old.change_reason);
  else
    action_label := 'deleted';
    entry_id := old.id;
    entry_employee_id := old.employee_id;
    device := old.device_info;
    reason_text := old.change_reason;
  end if;

  insert into public.time_entry_audit_logs (
    time_entry_id,
    employee_id,
    actor_user_id,
    action_type,
    previous_values,
    new_values,
    device_info,
    reason
  )
  values (
    entry_id,
    entry_employee_id,
    auth.uid(),
    action_label,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    device,
    reason_text
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists time_entries_prepare on public.time_entries;
create trigger time_entries_prepare
before insert or update on public.time_entries
for each row execute function public.prepare_time_entry();

drop trigger if exists time_entries_audit on public.time_entries;
create trigger time_entries_audit
after insert or update or delete on public.time_entries
for each row execute function public.audit_time_entry_change();

create or replace view public.employee_job_schedule
with (security_invoker = true)
as
select distinct
  j.id,
  j.customer,
  j.phone,
  j.job_name,
  j.address,
  j.system_type,
  j.square_feet,
  j.status,
  j.start_date,
  j.end_date,
  j.start_time,
  j.end_time,
  j.crew,
  j.notes,
  j.material_notes,
  j.floor_scopes,
  a.employee_id as assigned_employee_id,
  a.assigned_role
from public.jobs j
join public.employee_job_assignments a on a.job_id = j.id
where
  public.is_sefs_manager()
  or a.employee_id = public.current_employee_id();

alter table public.profiles enable row level security;
alter table public.employee_job_assignments enable row level security;
alter table public.time_entries enable row level security;
alter table public.time_entry_audit_logs enable row level security;

drop policy if exists "profiles select own or managers" on public.profiles;
create policy "profiles select own or managers"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_sefs_manager());

drop policy if exists "profiles managers insert" on public.profiles;
create policy "profiles managers insert"
on public.profiles for insert
to authenticated
with check (public.is_sefs_manager());

drop policy if exists "profiles managers update" on public.profiles;
create policy "profiles managers update"
on public.profiles for update
to authenticated
using (public.is_sefs_manager())
with check (public.is_sefs_manager());

drop policy if exists "assignments select own or managers" on public.employee_job_assignments;
create policy "assignments select own or managers"
on public.employee_job_assignments for select
to authenticated
using (employee_id = public.current_employee_id() or public.is_sefs_manager());

drop policy if exists "assignments managers manage" on public.employee_job_assignments;
create policy "assignments managers manage"
on public.employee_job_assignments for all
to authenticated
using (public.is_sefs_manager())
with check (public.is_sefs_manager());

drop policy if exists "time entries select own or managers" on public.time_entries;
create policy "time entries select own or managers"
on public.time_entries for select
to authenticated
using (employee_id = public.current_employee_id() or public.is_sefs_manager());

drop policy if exists "time entries employees insert own" on public.time_entries;
create policy "time entries employees insert own"
on public.time_entries for insert
to authenticated
with check (
  employee_id = public.current_employee_id()
  and coalesce(user_id, auth.uid()) = auth.uid()
  and status in ('draft', 'submitted')
);

drop policy if exists "time entries employees update own drafts" on public.time_entries;
create policy "time entries employees update own drafts"
on public.time_entries for update
to authenticated
using (
  employee_id = public.current_employee_id()
  and status in ('draft', 'rejected')
)
with check (
  employee_id = public.current_employee_id()
  and status in ('draft', 'submitted')
);

drop policy if exists "time entries employees delete own drafts" on public.time_entries;
create policy "time entries employees delete own drafts"
on public.time_entries for delete
to authenticated
using (
  employee_id = public.current_employee_id()
  and status = 'draft'
);

drop policy if exists "time entries managers manage" on public.time_entries;
create policy "time entries managers manage"
on public.time_entries for all
to authenticated
using (public.is_sefs_manager())
with check (public.is_sefs_manager());

drop policy if exists "audit logs select own or managers" on public.time_entry_audit_logs;
create policy "audit logs select own or managers"
on public.time_entry_audit_logs for select
to authenticated
using (employee_id = public.current_employee_id() or public.is_sefs_manager());

grant usage on schema public to authenticated;
grant select on public.employees to authenticated;
grant update (hourly_rate) on public.employees to authenticated;
grant select on public.employee_job_schedule to authenticated;
grant select on public.profiles to authenticated;
grant select on public.employee_job_assignments to authenticated;
grant select, insert, update, delete on public.time_entries to authenticated;
grant select on public.time_entry_audit_logs to authenticated;

-- Bootstrap note:
-- After creating your first admin user in Supabase Auth, run this once with that user's UUID:
-- insert into public.profiles (id, role, full_name, active)
-- values ('AUTH_USER_UUID_HERE', 'admin', 'SEFS Admin', true)
-- on conflict (id) do update set role = 'admin', active = true, full_name = excluded.full_name;
