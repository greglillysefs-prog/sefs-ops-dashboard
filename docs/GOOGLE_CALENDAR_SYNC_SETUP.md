# SEFS Google Calendar Backend Sync Setup

The dashboard now uses `supabase/functions/calendar-sync` for Google Calendar sync.
This is required for changes made from Google Calendar or Apple Calendar on a phone to update the SEFS schedule.

## Required Supabase SQL

Run this migration in Supabase SQL Editor:

`supabase/migrations/20260817041909_google_calendar_backend_sync.sql`

It adds:

- missing Google sync columns on `jobs`
- unique Google event ID protection
- `calendar_sync_state` for Google incremental sync tokens

## Required Supabase Secrets

Set these secrets on the Supabase project:

```powershell
supabase secrets set GOOGLE_CLIENT_ID="your-google-client-id" --project-ref wjfewzutxvjbbnnvbylo
supabase secrets set GOOGLE_CLIENT_SECRET="your-google-client-secret" --project-ref wjfewzutxvjbbnnvbylo
supabase secrets set GOOGLE_REFRESH_TOKEN="your-google-refresh-token" --project-ref wjfewzutxvjbbnnvbylo
supabase secrets set GOOGLE_CALENDAR_ID="primary" --project-ref wjfewzutxvjbbnnvbylo
supabase secrets set SEFS_PUBLIC_BASE_URL="https://sefs-ops-dashboard.pages.dev" --project-ref wjfewzutxvjbbnnvbylo
supabase secrets set SEFS_TIME_ZONE="America/Chicago" --project-ref wjfewzutxvjbbnnvbylo
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Supabase Edge Functions.

## Deploy Function

```powershell
supabase functions deploy calendar-sync --project-ref wjfewzutxvjbbnnvbylo --no-verify-jwt --use-api
```

## Manual Test

After SQL, secrets, and deployment:

```powershell
Invoke-RestMethod -Method Post -Uri "https://wjfewzutxvjbbnnvbylo.supabase.co/functions/v1/calendar-sync" -ContentType "application/json" -Body "{}"
```

Expected result:

```json
{
  "ok": true,
  "stats": {
    "pulled": 0,
    "imported": 0,
    "pushed": 0,
    "deleted": 0,
    "conflicts": 0,
    "errors": 0
  }
}
```

## Automatic Sync

After the manual test works, schedule the function to run every 1-5 minutes from Supabase.
The simple starting point is Supabase Scheduled Functions / Cron calling:

`https://wjfewzutxvjbbnnvbylo.supabase.co/functions/v1/calendar-sync`

The dashboard's `Sync Google Calendar` button calls the same function as a manual backup.

## New Google Calendar Events

New Google Calendar events are imported as SEFS jobs with:

- `status = Needs Review`
- `google_calendar_sync_status = Imported`

The function uses a local parser first. It extracts:

- title/customer/job label
- address
- phone number
- square footage
- system type
- date and time
- notes

It does not use the AI API by default. AI can be added later as a fallback for unclear calendar events.
