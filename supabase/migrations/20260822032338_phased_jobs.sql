alter table if exists public.jobs
  add column if not exists is_phased_job boolean not null default false,
  add column if not exists phase_parent_job_id uuid references public.jobs(id) on delete set null;

create index if not exists jobs_phase_parent_job_id_idx
  on public.jobs(phase_parent_job_id);

alter table if exists public.leads
  add column if not exists is_phased_job boolean not null default false,
  add column if not exists phase_parent_job_id uuid references public.jobs(id) on delete set null;

create index if not exists leads_phase_parent_job_id_idx
  on public.leads(phase_parent_job_id);
