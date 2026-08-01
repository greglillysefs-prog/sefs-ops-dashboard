create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  status text not null default 'Open',
  priority text not null default 'Normal',
  due_date date,
  due_time time,
  assigned_to text,
  show_on_schedule boolean not null default true,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  completed_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_audit_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  action_type text not null,
  previous_values jsonb,
  new_values jsonb,
  reason text,
  device_info text,
  created_at timestamptz not null default now()
);

create index if not exists task_audit_logs_task_idx
  on public.task_audit_logs(task_id, created_at desc);

alter table public.tasks enable row level security;
alter table public.task_audit_logs enable row level security;

drop policy if exists "Allow authenticated read tasks" on public.tasks;
drop policy if exists "Allow authenticated insert tasks" on public.tasks;
drop policy if exists "Allow authenticated update tasks" on public.tasks;
drop policy if exists "Allow authenticated delete tasks" on public.tasks;
drop policy if exists "Allow dashboard read tasks" on public.tasks;
drop policy if exists "Allow dashboard insert tasks" on public.tasks;
drop policy if exists "Allow dashboard update tasks" on public.tasks;
drop policy if exists "Allow dashboard delete tasks" on public.tasks;
drop policy if exists "Allow dashboard task access" on public.tasks;

create policy "Allow dashboard task access"
on public.tasks
for all
to public
using (true)
with check (true);

grant select, insert, update, delete on public.tasks to anon, authenticated;

drop policy if exists "Allow authenticated read task audit logs" on public.task_audit_logs;
drop policy if exists "Allow authenticated insert task audit logs" on public.task_audit_logs;
drop policy if exists "Allow dashboard read task audit logs" on public.task_audit_logs;
drop policy if exists "Allow dashboard insert task audit logs" on public.task_audit_logs;
drop policy if exists "Allow dashboard task audit access" on public.task_audit_logs;

create policy "Allow dashboard task audit access"
on public.task_audit_logs
for all
to public
using (true)
with check (true);

grant select, insert on public.task_audit_logs to anon, authenticated;
