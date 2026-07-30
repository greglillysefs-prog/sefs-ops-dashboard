create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  status text not null default 'Open',
  priority text not null default 'Normal',
  due_date date,
  due_time time,
  assigned_to text,
  show_on_schedule boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tasks enable row level security;

drop policy if exists "Allow authenticated read tasks" on tasks;
create policy "Allow authenticated read tasks"
  on tasks for select
  to authenticated
  using (true);

drop policy if exists "Allow authenticated insert tasks" on tasks;
create policy "Allow authenticated insert tasks"
  on tasks for insert
  to authenticated
  with check (true);

drop policy if exists "Allow authenticated update tasks" on tasks;
create policy "Allow authenticated update tasks"
  on tasks for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Allow authenticated delete tasks" on tasks;
create policy "Allow authenticated delete tasks"
  on tasks for delete
  to authenticated
  using (true);

grant select, insert, update, delete on tasks to authenticated;
