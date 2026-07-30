create table if not exists public.sms_intake_conversations (
  id uuid primary key default gen_random_uuid(),
  from_phone text not null,
  to_phone text,
  status text not null default 'collecting',
  latest_analysis jsonb,
  pending_fields text[] not null default '{}',
  pending_questions text[] not null default '{}',
  created_customer_id uuid references public.customers(id) on delete set null,
  created_lead_id uuid references public.leads(id) on delete set null,
  latest_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sms_intake_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.sms_intake_conversations(id) on delete cascade,
  twilio_message_sid text unique,
  direction text not null,
  from_phone text,
  to_phone text,
  body text,
  parsed_payload jsonb,
  response_body text,
  error text,
  created_at timestamptz not null default now()
);

alter table public.sms_intake_conversations add column if not exists from_phone text;
alter table public.sms_intake_conversations add column if not exists to_phone text;
alter table public.sms_intake_conversations add column if not exists status text default 'collecting';
alter table public.sms_intake_conversations add column if not exists latest_analysis jsonb;
alter table public.sms_intake_conversations add column if not exists pending_fields text[] default '{}';
alter table public.sms_intake_conversations add column if not exists pending_questions text[] default '{}';
alter table public.sms_intake_conversations add column if not exists created_customer_id uuid;
alter table public.sms_intake_conversations add column if not exists created_lead_id uuid;
alter table public.sms_intake_conversations add column if not exists latest_message_at timestamptz default now();
alter table public.sms_intake_conversations add column if not exists created_at timestamptz default now();
alter table public.sms_intake_conversations add column if not exists updated_at timestamptz default now();

alter table public.sms_intake_messages add column if not exists conversation_id uuid;
alter table public.sms_intake_messages add column if not exists twilio_message_sid text;
alter table public.sms_intake_messages add column if not exists direction text;
alter table public.sms_intake_messages add column if not exists from_phone text;
alter table public.sms_intake_messages add column if not exists to_phone text;
alter table public.sms_intake_messages add column if not exists body text;
alter table public.sms_intake_messages add column if not exists parsed_payload jsonb;
alter table public.sms_intake_messages add column if not exists response_body text;
alter table public.sms_intake_messages add column if not exists error text;
alter table public.sms_intake_messages add column if not exists created_at timestamptz default now();

create index if not exists sms_intake_conversations_from_status_idx on public.sms_intake_conversations(from_phone, status, latest_message_at desc);
create index if not exists sms_intake_conversations_created_lead_idx on public.sms_intake_conversations(created_lead_id);
create index if not exists sms_intake_messages_conversation_idx on public.sms_intake_messages(conversation_id, created_at);
create index if not exists sms_intake_messages_sid_idx on public.sms_intake_messages(twilio_message_sid);

alter table public.sms_intake_conversations enable row level security;
alter table public.sms_intake_messages enable row level security;
