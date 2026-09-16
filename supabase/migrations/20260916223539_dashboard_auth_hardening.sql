-- First staged security hardening for the static dashboard.
--
-- The main dashboard now requires an existing active manager/admin Supabase Auth
-- profile before it initializes. This migration only applies low-risk database
-- changes that line up with existing authenticated flows and avoids broad RLS
-- changes on jobs/leads/photos that could break crew mobile links or workflows.

alter table if exists public.inventory_items enable row level security;

revoke all on table public.inventory_items from anon;
grant select, update on table public.inventory_items to authenticated;

drop policy if exists "inventory authenticated read" on public.inventory_items;
create policy "inventory authenticated read"
on public.inventory_items
for select
to authenticated
using (true);

drop policy if exists "inventory authenticated update" on public.inventory_items;
create policy "inventory authenticated update"
on public.inventory_items
for update
to authenticated
using (true)
with check (true);

do $$
begin
  if to_regclass('public.inventory_change_logs') is not null then
    revoke all on table public.inventory_change_logs from anon;
    grant select, insert on table public.inventory_change_logs to authenticated;
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.audit_time_entry_change()') is not null then
    revoke execute on function public.audit_time_entry_change() from anon;
    grant execute on function public.audit_time_entry_change() to authenticated;
  end if;

  if to_regprocedure('public.current_employee_id()') is not null then
    revoke execute on function public.current_employee_id() from anon;
    grant execute on function public.current_employee_id() to authenticated;
  end if;

  if to_regprocedure('public.current_profile_role()') is not null then
    revoke execute on function public.current_profile_role() from anon;
    grant execute on function public.current_profile_role() to authenticated;
  end if;

  if to_regprocedure('public.is_sefs_manager()') is not null then
    revoke execute on function public.is_sefs_manager() from anon;
    grant execute on function public.is_sefs_manager() to authenticated;
  end if;
end $$;
