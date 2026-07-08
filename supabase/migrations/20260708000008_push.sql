-- Web push subscriptions (one per browser/device, per user) and an alert log
-- used to avoid sending the same reminder repeatedly.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;
create policy "own subs read"   on push_subscriptions for select using (user_id = auth.uid());
create policy "own subs insert" on push_subscriptions for insert with check (user_id = auth.uid());
create policy "own subs delete" on push_subscriptions for delete using (user_id = auth.uid());

-- Dedupe: one row per (baby, alert kind, key). key = the feed id for
-- feed-due, or the local date for daily nappy nudges.
create table baby_alert_log (
  baby_id uuid not null references babies on delete cascade,
  kind text not null,
  dedupe_key text not null,
  sent_at timestamptz not null default now(),
  primary key (baby_id, kind, dedupe_key)
);
-- Written only by the service-role cron sender; no anon access.
alter table baby_alert_log enable row level security;
