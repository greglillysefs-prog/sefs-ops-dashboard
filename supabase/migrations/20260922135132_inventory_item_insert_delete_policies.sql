-- Allow the signed-in dashboard inventory workflow to add and remove materials
-- after inventory_items RLS was enabled. Anonymous users remain revoked.

alter table if exists public.inventory_items enable row level security;

revoke all on table public.inventory_items from anon;
grant select, insert, update, delete on table public.inventory_items to authenticated;

drop policy if exists "inventory authenticated insert" on public.inventory_items;
create policy "inventory authenticated insert"
on public.inventory_items
for insert
to authenticated
with check (true);

drop policy if exists "inventory authenticated delete" on public.inventory_items;
create policy "inventory authenticated delete"
on public.inventory_items
for delete
to authenticated
using (true);
