-- AI handover summaries — a one-page consult report a parent generates and
-- shares with their midwife / health visitor / lactation consultant. Stored
-- so the printable page doesn't regenerate on every view.
create table handover_reports (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies on delete cascade,
  content text not null, -- markdown
  created_by uuid not null default auth.uid() references auth.users,
  created_at timestamptz not null default now()
);
create index handover_reports_baby_idx
  on handover_reports (baby_id, created_at desc);

alter table handover_reports enable row level security;

create policy "member reads handover" on handover_reports
  for select using (is_baby_member(baby_id));
create policy "editor inserts handover" on handover_reports
  for insert with check (can_edit_baby(baby_id));
create policy "editor deletes handover" on handover_reports
  for delete using (can_edit_baby(baby_id));
