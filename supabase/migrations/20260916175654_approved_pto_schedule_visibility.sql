alter table public.pto_requests enable row level security;

drop policy if exists "pto requests approved schedule read" on public.pto_requests;
create policy "pto requests approved schedule read"
on public.pto_requests
for select
to anon, authenticated
using (status = 'approved');

grant select on public.pto_requests to anon, authenticated;
