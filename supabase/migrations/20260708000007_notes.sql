-- Consultation notes: questions to ask, tagged to people, with answers
-- recorded at the appointment. Follows the same edit rules as entries
-- (owner/caregiver write; viewer read-only), enforced by RLS.
create table baby_notes (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies on delete cascade,
  body text not null,
  answer text,
  answered_at timestamptz,
  answered_by uuid references auth.users,
  tagged_user_ids uuid[] not null default '{}',
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index baby_notes_baby_idx on baby_notes (baby_id, created_at desc);

alter table baby_notes enable row level security;
create policy "member reads notes"  on baby_notes for select using (is_baby_member(baby_id));
create policy "editor inserts notes" on baby_notes for insert with check (can_edit_baby(baby_id));
create policy "editor updates notes" on baby_notes for update using (can_edit_baby(baby_id));
create policy "editor deletes notes" on baby_notes for delete using (can_edit_baby(baby_id));

create trigger baby_notes_updated_at before update on baby_notes
  for each row execute function set_updated_at();
