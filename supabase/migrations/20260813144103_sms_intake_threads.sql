create table if not exists sms_intake_threads (
  id uuid primary key default gen_random_uuid(),
  sender_phone text not null,
  original_message text not null,
  combined_message text not null,
  status text not null default 'open',
  last_question text,
  lead_id uuid,
  customer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sms_intake_logs (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references sms_intake_threads(id) on delete set null,
  sender_phone text,
  inbound_message text not null,
  outbound_message text,
  parsed_intake jsonb,
  action text,
  created_at timestamptz not null default now()
);

create index if not exists sms_intake_threads_sender_status_idx
  on sms_intake_threads(sender_phone, status, updated_at desc);

create index if not exists sms_intake_logs_thread_idx
  on sms_intake_logs(thread_id, created_at desc);

alter table sms_intake_threads enable row level security;
alter table sms_intake_logs enable row level security;
