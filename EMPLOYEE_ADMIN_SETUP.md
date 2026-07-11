# SEFS Employee Admin Setup

The Employee Admin page uses a Supabase Edge Function so the Supabase service-role key never lives in browser code.

## One-time Supabase setup

1. Run `employee_portal_setup.sql` in the Supabase SQL Editor.
2. Install the Supabase CLI if it is not installed.
3. Log in to the Supabase CLI.
4. Set the employee admin PIN secret.
5. Deploy the `employee-admin` function.

```powershell
npm install -g supabase
supabase login
supabase secrets set SEFS_EMPLOYEE_ADMIN_PIN="choose-a-private-pin" --project-ref wjfewzutxvjbbnnvbylo
supabase functions deploy employee-admin --project-ref wjfewzutxvjbbnnvbylo
```

Supabase automatically provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.

## Test links

- Dashboard: `http://127.0.0.1:4173/index.html`
- Employee Admin: `http://127.0.0.1:4173/employee-admin.html`
- Employee Portal: `http://127.0.0.1:4173/employee-portal.html`

## If Employee Admin says it is not connected

That means the Edge Function is not deployed yet, the secret is missing, or the PIN entered on the page does not match `SEFS_EMPLOYEE_ADMIN_PIN`.
