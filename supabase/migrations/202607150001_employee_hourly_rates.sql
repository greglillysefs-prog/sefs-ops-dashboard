alter table public.employees
add column if not exists hourly_rate numeric(10,2) not null default 0;

grant select on public.employees to authenticated;
grant update (hourly_rate) on public.employees to authenticated;
