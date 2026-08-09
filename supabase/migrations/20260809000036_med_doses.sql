-- One-off medicine doses ("gave Calpol 2.5 ml at 3am") alongside the
-- existing course model (started/stopped, reminders). Doses are medication
-- entries with med_kind = 'dose': occurred_at is when it was given, no
-- ended_at, no reminders. Existing rows stay 'course'.
alter table entries add column if not exists med_kind text not null default 'course'
  check (med_kind in ('course', 'dose'));
