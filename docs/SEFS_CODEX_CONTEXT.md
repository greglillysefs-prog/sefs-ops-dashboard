# SEFS Codex Project Context

Read this file first when working on the SEFS Ops Dashboard from any PC or Codex session.

## Current Branch

- Primary working branch: `sefs-ui-workflow-revamp`
- Main project folder: `C:\Users\Greg\Desktop\SEFS_CLEAN\sefs-ops-dashboard`
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
- Employee portal phone navigation uses a `Go To` dropdown for Schedule, Time, Entries.
- Desktop navigation should remain full/sidebar-oriented.

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

