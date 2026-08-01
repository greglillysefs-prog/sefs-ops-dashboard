create table if not exists public.quote_settings (
  key text primary key,
  value numeric not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.quote_settings (key, value, notes)
values
  ('minimum_job_price', 1500, 'Minimum customer quote price.'),
  ('minimum_margin_dollars', 200, 'Minimum required margin/profit dollars before service fee is added.')
on conflict (key) do nothing;

alter table public.quote_settings enable row level security;

drop policy if exists "quote_settings_read_public" on public.quote_settings;
create policy "quote_settings_read_public"
on public.quote_settings
for select
using (true);

drop policy if exists "quote_settings_write_public" on public.quote_settings;
create policy "quote_settings_write_public"
on public.quote_settings
for all
using (true)
with check (true);
