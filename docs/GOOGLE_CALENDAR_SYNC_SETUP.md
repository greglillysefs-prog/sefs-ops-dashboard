# SEFS Google Calendar Backend Sync Setup

Deprecated: the two-way Google Calendar OAuth sync has been retired from the dashboard.

The active calendar sharing path is now the read-only subscribed calendar feed documented in `docs/CALENDAR_FEED_SETUP.md`. Dashboard/Supabase remains the editable source of truth. Apple Calendar, Google Calendar, and other subscribers can display the schedule from the feed, but they do not write changes back to SEFS.

The old `sefs-google-calendar-sync` Supabase cron job has been unscheduled by `supabase/migrations/20260826130149_retire_google_calendar_sync_cron.sql`.
