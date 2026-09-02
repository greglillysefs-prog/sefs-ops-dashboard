alter table public.inspections
  add column if not exists scheduled_time text,
  add column if not exists assigned_employee_id uuid,
  add column if not exists status text not null default 'Open';

alter table public.callbacks
  add column if not exists scheduled_time text,
  add column if not exists assigned_employee_id uuid,
  add column if not exists assigned_to text;

create index if not exists inspections_job_id_idx on public.inspections(job_id);
create index if not exists callbacks_job_id_idx on public.callbacks(job_id);
create index if not exists inspections_assigned_employee_id_idx on public.inspections(assigned_employee_id);
create index if not exists callbacks_assigned_employee_id_idx on public.callbacks(assigned_employee_id);
