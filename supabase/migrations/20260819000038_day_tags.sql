-- Day tags: whole-day observations that aren't point-in-time events —
-- "no poo today" (common and usually normal, but worth spotting patterns
-- against sleep) and "teething day". One row per baby/day/tag; `day` is the
-- family's local calendar date as shown on the History calendar. Same edit
-- rules as entries (owner/caregiver write; viewer read-only), enforced by RLS.
create table baby_day_tags (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies on delete cascade,
  day date not null,
  tag text not null check (tag in ('no_poo', 'teething')),
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  unique (baby_id, day, tag)
);
create index baby_day_tags_baby_idx on baby_day_tags (baby_id, day desc);

alter table baby_day_tags enable row level security;

create policy "member reads day tags" on baby_day_tags for select
  using (is_baby_member(baby_id));
create policy "editor inserts day tags" on baby_day_tags for insert
  with check (can_edit_baby(baby_id) and created_by = auth.uid());
create policy "editor deletes day tags" on baby_day_tags for delete
  using (can_edit_baby(baby_id));
-- No update policy: a tag is toggled by insert/delete, never edited.
