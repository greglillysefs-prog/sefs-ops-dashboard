alter table tasks add column if not exists completed_at timestamptz;
alter table tasks add column if not exists completed_by uuid references auth.users(id) on delete set null;
alter table tasks add column if not exists completed_by_name text;

create table if not exists task_audit_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  action_type text not null,
  previous_values jsonb,
  new_values jsonb,
  reason text,
  device_info text,
  created_at timestamptz not null default now()
);

alter table task_audit_logs enable row level security;

drop policy if exists "Allow authenticated read task audit logs" on task_audit_logs;
create policy "Allow authenticated read task audit logs"
  on task_audit_logs for select
  to authenticated
  using (true);

drop policy if exists "Allow authenticated insert task audit logs" on task_audit_logs;
create policy "Allow authenticated insert task audit logs"
  on task_audit_logs for insert
  to authenticated
  with check (true);

create index if not exists task_audit_logs_task_idx on task_audit_logs(task_id, created_at desc);
grant select, insert on task_audit_logs to authenticated;
