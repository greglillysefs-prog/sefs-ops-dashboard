create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

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

select cron.schedule(
  'sefs-google-calendar-sync',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://wjfewzutxvjbbnnvbylo.supabase.co/functions/v1/calendar-sync',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);
