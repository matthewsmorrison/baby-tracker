-- Private per-user settings. Unlike profiles (readable by co-members and
-- friends), only the owner can see this row — so "appear offline" doesn't
-- leak the fact that someone chose to hide.
create table user_settings (
  user_id uuid primary key references profiles (id) on delete cascade,
  appear_offline boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "own settings read" on user_settings for select
  using (user_id = auth.uid());
create policy "own settings insert" on user_settings for insert
  with check (user_id = auth.uid());
create policy "own settings update" on user_settings for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
