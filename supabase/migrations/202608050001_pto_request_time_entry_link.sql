alter table public.pto_requests
  add column if not exists time_entry_id uuid references public.time_entries(id) on delete set null;

create index if not exists pto_requests_time_entry_id_idx
  on public.pto_requests(time_entry_id);
