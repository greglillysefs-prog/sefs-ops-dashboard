alter table public.jobs add column if not exists google_calendar_event_id text;
alter table public.jobs add column if not exists google_calendar_synced_at timestamptz;
alter table public.jobs add column if not exists google_calendar_updated_at timestamptz;
alter table public.jobs add column if not exists google_calendar_sync_status text default 'Not Synced';
alter table public.jobs add column if not exists google_calendar_sync_error text;
alter table public.jobs add column if not exists google_calendar_last_snapshot jsonb;
alter table public.jobs add column if not exists supabase_synced_at timestamptz;

create unique index if not exists jobs_google_calendar_event_id_uidx
  on public.jobs(google_calendar_event_id)
  where google_calendar_event_id is not null;

create index if not exists jobs_google_calendar_sync_status_idx
  on public.jobs(google_calendar_sync_status);

create table if not exists public.calendar_sync_state (
  key text primary key,
  calendar_id text not null default 'primary',
  sync_token text,
  last_full_sync_at timestamptz,
  last_incremental_sync_at timestamptz,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_sync_state enable row level security;

revoke all on public.calendar_sync_state from anon;
revoke all on public.calendar_sync_state from authenticated;
