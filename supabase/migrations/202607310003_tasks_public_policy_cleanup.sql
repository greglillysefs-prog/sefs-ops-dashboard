drop policy if exists "Allow authenticated read tasks" on public.tasks;
drop policy if exists "Allow authenticated insert tasks" on public.tasks;
drop policy if exists "Allow authenticated update tasks" on public.tasks;
drop policy if exists "Allow authenticated delete tasks" on public.tasks;
drop policy if exists "Allow dashboard read tasks" on public.tasks;
drop policy if exists "Allow dashboard insert tasks" on public.tasks;
drop policy if exists "Allow dashboard update tasks" on public.tasks;
drop policy if exists "Allow dashboard delete tasks" on public.tasks;

create policy "Allow dashboard task access"
on public.tasks
for all
to public
using (true)
with check (true);

grant select, insert, update, delete on public.tasks to anon, authenticated;

drop policy if exists "Allow authenticated read task audit logs" on public.task_audit_logs;
drop policy if exists "Allow authenticated insert task audit logs" on public.task_audit_logs;
drop policy if exists "Allow dashboard read task audit logs" on public.task_audit_logs;
drop policy if exists "Allow dashboard insert task audit logs" on public.task_audit_logs;

create policy "Allow dashboard task audit access"
on public.task_audit_logs
for all
to public
using (true)
with check (true);

grant select, insert on public.task_audit_logs to anon, authenticated;
