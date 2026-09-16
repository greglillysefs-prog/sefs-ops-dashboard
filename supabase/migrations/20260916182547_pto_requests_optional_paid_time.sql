alter table public.pto_requests
  add column if not exists use_pto boolean not null default true;

alter table public.pto_requests
  drop constraint if exists pto_requests_hours_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pto_requests_hours_nonnegative_check'
      and conrelid = 'public.pto_requests'::regclass
  ) then
    alter table public.pto_requests
      add constraint pto_requests_hours_nonnegative_check check (hours >= 0);
  end if;
end $$;

create index if not exists pto_requests_use_pto_idx
  on public.pto_requests(use_pto);
