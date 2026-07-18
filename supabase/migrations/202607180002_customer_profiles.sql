create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  status text default 'Active',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table customers add column if not exists name text;
alter table customers add column if not exists phone text;
alter table customers add column if not exists email text;
alter table customers add column if not exists address text;
alter table customers add column if not exists status text default 'Active';
alter table customers add column if not exists notes text;
alter table customers add column if not exists created_at timestamptz default now();
alter table customers add column if not exists updated_at timestamptz default now();

alter table leads add column if not exists customer_id uuid;
alter table jobs add column if not exists customer_id uuid;
alter table quotes add column if not exists customer_id uuid;
alter table field_measurements add column if not exists customer_id uuid;

create index if not exists customers_name_idx on customers(lower(name));
create index if not exists customers_phone_idx on customers(phone);
create index if not exists customers_email_idx on customers(lower(email));
create index if not exists leads_customer_idx on leads(customer_id);
create index if not exists jobs_customer_idx on jobs(customer_id);
create index if not exists quotes_customer_idx on quotes(customer_id);
create index if not exists field_measurements_customer_idx on field_measurements(customer_id);
