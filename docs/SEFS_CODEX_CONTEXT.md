# SEFS Codex Project Context

Read this file first when working on the SEFS Ops Dashboard from any PC or Codex session.

## Current Branch

- Primary working branch: `sefs-ui-workflow-revamp`
- Main project folder on this PC: `C:\Users\Aiden\sefs-ops-dashboard`
- Older/other PC path that may appear in notes: `C:\Users\Greg\Desktop\SEFS_CLEAN\sefs-ops-dashboard`
- The project is a static dashboard with Supabase as the cloud backend.
- Do not assume local browser storage is the source of truth. Supabase should hold shared business data.

## Core Rule

Preserve all existing working behavior unless the user explicitly asks to change it:

- Supabase reads/writes
- Photo uploads
- Quote calculations
- Quote-to-lead-to-job workflow
- Customer profile linking
- Inventory/material costs
- Systems/material recipes
- Pull sheets
- Calendar and Google Calendar sync behavior
- Employee portal, time tracking, PTO, audit logs
- Cloudflare/static deploy compatibility

## Project Shape

- `index.html`: main SEFS Operations Dashboard.
- `quote-builder.html`: quote builder embedded in the dashboard iframe and usable full-page.
- `mobile-job.html`: limited mobile job view for crews; no quote pricing/admin data should be exposed.
- `employee-portal.html`: employee login, schedule, time entry, PTO, manager review.
- `employee-admin.html`: employee portal access management.
- `supabase/*.ts`: Supabase Edge Functions.
- `*.sql`: Supabase schema/setup scripts.
- `sms-compliance-site/`: simple compliance website for Twilio A2P/SMS registration.

## Current Business Workflow

Target workflow:

Lead -> Field Measure -> Quote Builder -> Quote Saved -> Job -> Schedule -> Done

Important behavior:

- Leads created directly should not become schedulable jobs until they go through the quote builder.
- Quote-created jobs should carry material lists, measured areas, photos, quote options, system details, and customer linkage.
- Leads converted through the quote workflow should become `Won` and stay linked to the resulting quote/job.
- Jobs awaiting schedule and new leads should show in dashboard follow-up/today views.
- Scheduled jobs should expose quote/material buttons in the dashboard calendar.
- Mobile job links should show crew-safe job details only, including materials without costs.

## Quote Builder

Important expectations:

- Default flake size should be `1/4`.
- Labor is based on manually entered men/days for quotes, not fixed hidden defaults.
- Waste should not inflate quote calculations.
- Materials should come from system recipes and inventory costs where available.
- Quote material sheets should show costs/totals inside quote builder, but crew-facing material lists should not show pricing.
- Multiple systems/floors must stay separate with their own sqft and selected options.
- Selected options like flake size, finish sealer, cove, etc. must transfer from quote to job/mobile job/material list.

## Systems, Inventory, and Pull Sheets

Important expectations:

- Systems page defines system variations, options, and material recipes.
- Inventory page should support table-style bulk material cost edits.
- Unit costs should flow from inventory into systems/material recipe displays and quote calculations.
- System recipe materials must force either:
  - `Always`
  - or a valid system option/value condition selected from dropdown/checklist controls.
- Avoid free-typing option conditions when a structured dropdown/checklist can be used.
- Pull sheets should ask only relevant options for the chosen system.
- Pull sheets should hide/ignore follow-up options when parent option is `No`.
- Pull sheet quantities should round up for items that cannot be partially pulled.
- Pull sheet should not show labor rate or labor cost.

## Customers

Customer profiles are now part of the workflow:

- Customers tab should search customers and show related leads, quotes, jobs, notes, and history.
- Customer lookup should be consistent across quote builder, lead creation, job creation, and field measure.
- Preferred lookup UX: type into customer fields and see matching existing customers automatically.
- Avoid clunky non-searchable customer dropdowns.

## Schedule and Calendar

Important expectations:

- Dashboard calendar is the source UI for scheduling jobs.
- Jobs can be dragged/rescheduled in the dashboard calendar.
- Multi-day jobs should show as one spanning block, similar to Google Calendar.
- Scheduling a job requires assigning a crew lead.
- Assigned crew lead should see that job in their employee portal schedule.
- Employee portal schedule should be calendar-like and read-only for schedule changes.
- Employees can still add photos/notes and access material lists for assigned jobs.

## Google Calendar Sync

Supabase/dashboard remains source of truth for full job records.

Google Calendar can sync schedule-related fields only:

- Date/time
- Title/customer/system
- Location/address
- Notes/description

Do not allow Google Calendar to overwrite:

- Quotes
- Materials
- Pull sheets
- Inventory
- Pricing
- Customer financials
- Admin/labor/waste calculations

Calendar event descriptions should not expose quote pricing or quote access. Calendar links should open the limited mobile job page only.

Current Google OAuth test note:

- If Google Calendar sync shows `Error 400: origin_mismatch`, the dashboard URL being used is missing from the Google OAuth Client's Authorized JavaScript origins.
- For local testing, the OAuth client should include exact origins such as:
  - `http://127.0.0.1:4173`
  - `http://localhost:4173`
  - `http://192.168.68.131:4173`
- If using older dev ports, also include matching `5173` / `5174` origins.
- Origins must match exactly, including `http` and port.

## Field Measure

Field Measure is mobile-friendly and should:

- Select or create lead/customer/job.
- Add multiple measured areas/rooms.
- Store area name, length, width, sqft, notes, floor condition, cracks/spalls/joints/moisture notes, photos.
- Auto-total sqft.
- Save measurements to Supabase.
- Attach photos to the correct lead/job/quote/job chain.
- Export to quote without automatically overwriting pricing.

## Employee Portal

Employee portal goals:

- Supabase Auth login.
- Role support: `employee`, `crew_lead`, `manager`, `admin`.
- Employees see only their own entries.
- Managers/admins can review, approve, reject, and edit.
- Crew leads can enter time for selected crew members where allowed.
- Time entries include job/other, date, start time, end time, calculated hours, notes, photos, and status.
- Break minutes were removed from the employee time form.
- Start/end times should be easy to type and should snap to 15-minute intervals.
- Default work date should be today.
- Default start time should be 6:00 AM.
- Group time entry must only submit for selected employees and prevent accidental duplicates for the same employee/group/time.
- Show a clear time submitted message after submit.
- Pay periods run Wednesday through Tuesday.
- Employee pay-period summaries should show approved and submitted hours for non-management users.
- Manager/admin payroll summary should include approved hours only.
- Approved/rejected time should be separated from pending review.
- Employee changes should show in a rolling audit/change log.

PTO:

- Employees can request PTO only for future dates.
- PTO requests must not exceed available PTO.
- Only manager/admin can approve PTO.
- Removed employees should not appear as active employees, but their historical audit/time/PTO records should remain preserved.

## SMS Quick Intake Parser

Current approach:

- Use the local parser first, not AI.
- Parser should understand messy text like:
  - customer name
  - phone number
  - address
  - sqft
  - system type
  - follow-up timing such as "follow up in 3 days"
- It should ask follow-up questions when required info is missing.
- Twilio integration is being explored for texting the parser.
- Main business contact number should be `3212848168`.
- Parser Twilio number is separate and should not be presented as the public Southeast Flooring Solutions contact number.

Current Twilio/A2P status from latest user screenshot:

- Twilio account appears active.
- A2P Brand `SEFS` shows `Approved`.
- A2P 10DLC campaign badge still appeared `In review` in the screenshot, so verify campaign approval before assuming production SMS is fully live.
- Messaging Service exists and was created July 26, 2026 at 05:22 UTC.

## SMS Compliance

Compliance pages exist for Twilio registration:

- `privacy.html`
- `terms.html`
- `sms-compliance-site/`

SMS campaign use case is internal SEFS job intake and operations messages for employees/approved internal contacts. Messages should include STOP/HELP language and avoid marketing claims.

## Mobile UI

The dashboard and portals should work on phones and PCs.

Recent mobile navigation update:

- Dashboard phone navigation uses a `Go To` dropdown instead of many top buttons.
- Dashboard mobile dropdown includes dashboard tabs, quick actions (`New Lead`, `New Task`, `New Job`), and portal links.
- Dashboard mobile hides the large `Start Work` button card; quick actions should live in the dropdown on phones.
- Employee portal phone navigation uses a `Go To` dropdown. Current target sections are Schedule, Add Time, Entries, PTO, Pay Periods, Time Review, and Pay Rates.
- Employee portal dropdown choices should show one focused panel at a time on phones. Avoid reintroducing duplicate mobile tiles/buttons for these same destinations.
- Employee Portal/Admin links from mobile dropdown should use same-tab navigation (`location.assign`) instead of `window.open`, because mobile browsers can block dropdown-triggered popups.
- Desktop navigation should remain full/sidebar-oriented.

## Latest Session Notes

2026-07-31:

- Latest known branch commit: `a3c5de5 Streamline quote builder workspace`.
- Recent related commits:
  - `5474b36 Add quote price sheet controls`
  - `52719a5 Move tasks navigation to production`
  - `15f28b4 Wire system option materials into quotes`
  - `353d67e Harden modal save handling`
- Quote builder was cleaned up to feel more like the dashboard:
  - Removed the huge inline/base64 logo payload from `quote-builder.html`.
  - Replaced quote-builder logo references with `assets/sefs-icon.jpeg`.
  - Reworked the start screen into a compact Quote Workspace flow.
  - Fixed the New Quote flow so it moves to the customer form and sets the correct active step.
  - Verified `quote-builder.html` direct in browser with no console errors after the cleanup.
- Quote builder file size was reduced substantially by removing embedded base64 image data.
- GitHub push note:
  - A push showed `update_ref failed for ref 'refs/remotes/origin/sefs-ui-workflow-revamp'`.
  - `git ls-remote` confirmed GitHub already had commit `a3c5de5`.
  - Local stale remote-tracking ref was repaired with `git update-ref refs/remotes/origin/sefs-ui-workflow-revamp a3c5de5...`.
  - If this happens again, first verify GitHub with `git ls-remote origin refs/heads/sefs-ui-workflow-revamp` before assuming the push failed.

## Development Rules for Codex

Before making changes:

1. Run `git status --short --branch`.
2. Confirm branch is `sefs-ui-workflow-revamp` unless the user says otherwise.
3. Read this file.
4. Inspect relevant code before editing.

While changing code:

- Keep edits scoped.
- Prefer existing patterns and helper functions.
- Use structured data instead of string hacks where reasonable.
- Do not remove unrelated user changes.
- Do not rewrite the dashboard from scratch.
- Use `apply_patch` for manual file edits.
- Commit each major working milestone separately.

Before final response:

- Run a targeted verification when practical.
- Mention what was changed and what was tested.
- If a server is running, give the LAN/mobile links when useful.

## Useful Local Links

When the local server is running on port `4173`, use:

- Dashboard: `http://127.0.0.1:4173/index.html`
- Employee Portal: `http://127.0.0.1:4173/employee-portal.html`
- Employee Admin: `http://127.0.0.1:4173/employee-admin.html`
- Mobile Job: `http://127.0.0.1:4173/mobile-job.html`

For phone testing on the same network, use the current PC LAN IP with port `4173`.
