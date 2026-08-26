# SEFS Subscribed Calendar Feed

This feed publishes the SEFS dashboard schedule as a read-only `.ics` calendar.

Purpose:
- Supabase/dashboard remains the source of truth.
- Apple Calendar and Google Calendar can subscribe to the schedule.
- Jobs, lead follow-ups, and tasks with dates appear on the subscribed calendar.
- The feed avoids Google OAuth refresh-token failures because it does not write back from Google.

Feed endpoint:

```text
https://wjfewzutxvjbbnnvbylo.supabase.co/functions/v1/calendar-feed?token=YOUR_PRIVATE_FEED_TOKEN
```

Required Supabase secret:

```bash
supabase secrets set SEFS_CALENDAR_FEED_TOKEN="YOUR_PRIVATE_FEED_TOKEN" --project-ref wjfewzutxvjbbnnvbylo
```

Recommended optional secrets:

```bash
supabase secrets set SEFS_PUBLIC_BASE_URL="https://sefs-ops-dashboard.pages.dev" --project-ref wjfewzutxvjbbnnvbylo
supabase secrets set SEFS_TIME_ZONE="America/Chicago" --project-ref wjfewzutxvjbbnnvbylo
```

Deploy command:

```bash
supabase functions deploy calendar-feed --project-ref wjfewzutxvjbbnnvbylo --no-verify-jwt --use-api
```

iPhone subscription:

1. Open Settings.
2. Go to Calendar.
3. Go to Accounts.
4. Tap Add Account.
5. Tap Other.
6. Tap Add Subscribed Calendar.
7. Paste the feed URL.
8. Tap Next, then Save.

Google Calendar subscription:

1. Open Google Calendar in a desktop browser.
2. Next to Other calendars, click `+`.
3. Choose From URL.
4. Paste the feed URL.
5. Add the calendar.

Important behavior:
- This feed is read-only.
- Calendar clients decide how often they refresh subscribed feeds.
- Do not share the token URL publicly. Anyone with the URL can view schedule details.
- The feed does not include quote pricing, profit, margin, or admin pricing data.
