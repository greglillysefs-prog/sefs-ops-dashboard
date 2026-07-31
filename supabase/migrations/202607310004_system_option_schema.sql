alter table public.system_recipes
add column if not exists option_schema jsonb default '[]'::jsonb;
