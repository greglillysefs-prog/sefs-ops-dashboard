create table if not exists public.pto_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  request_date date not null,
  hours numeric(8,2) not null check (hours > 0),
  notes text,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected', 'canceled')),
  manager_id uuid references auth.users(id) on delete set null,
  manager_note text,
  decided_at timestamptz,
  personal_time_entry_id uuid,
  time_entry_id uuid references public.time_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pto_requests
  add column if not exists time_entry_id uuid references public.time_entries(id) on delete set null;

alter table public.pto_requests enable row level security;

create index if not exists pto_requests_employee_id_idx on public.pto_requests(employee_id);
create index if not exists pto_requests_status_idx on public.pto_requests(status);
create index if not exists pto_requests_request_date_idx on public.pto_requests(request_date);
create index if not exists pto_requests_time_entry_id_idx on public.pto_requests(time_entry_id);
