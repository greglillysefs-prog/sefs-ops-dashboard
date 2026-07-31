drop policy if exists "Allow dashboard read tasks" on public.tasks;
create policy "Allow dashboard read tasks"
on public.tasks
for select
to anon, authenticated
using (true);

drop policy if exists "Allow dashboard insert tasks" on public.tasks;
create policy "Allow dashboard insert tasks"
on public.tasks
for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow dashboard update tasks" on public.tasks;
create policy "Allow dashboard update tasks"
on public.tasks
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow dashboard delete tasks" on public.tasks;
create policy "Allow dashboard delete tasks"
on public.tasks
for delete
to anon, authenticated
using (true);

grant select, insert, update, delete on public.tasks to anon, authenticated;

drop policy if exists "Allow dashboard read task audit logs" on public.task_audit_logs;
create policy "Allow dashboard read task audit logs"
on public.task_audit_logs
for select
to anon, authenticated
using (true);

drop policy if exists "Allow dashboard insert task audit logs" on public.task_audit_logs;
create policy "Allow dashboard insert task audit logs"
on public.task_audit_logs
for insert
to anon, authenticated
with check (true);

grant select, insert on public.task_audit_logs to anon, authenticated;
