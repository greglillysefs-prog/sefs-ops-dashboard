-- Retire the old two-way Google Calendar backend sync.
-- The schedule is now shared through the read-only calendar-feed function.

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'sefs-google-calendar-sync'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end $$;
