-- APNs device tokens for the native iOS app. One row per device; the cron
-- notifier fans out to these alongside web-push subscriptions. Users manage
-- only their own tokens.
create table ios_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
create index ios_push_tokens_user_idx on ios_push_tokens (user_id);

alter table ios_push_tokens enable row level security;

create policy "own tokens read" on ios_push_tokens for select
  using (user_id = auth.uid());
create policy "own tokens insert" on ios_push_tokens for insert
  with check (user_id = auth.uid());
create policy "own tokens update" on ios_push_tokens for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tokens delete" on ios_push_tokens for delete
  using (user_id = auth.uid());
