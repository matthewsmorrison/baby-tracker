-- Link a professional profile to an auth account (claimed when they sign in
-- with the matching email), so referred families can add them as a read-only
-- viewer and they get a dashboard.
alter table professionals add column if not exists user_id uuid references auth.users;
alter table professionals add column if not exists email text;
create unique index if not exists professionals_user_id_key
  on professionals (user_id) where user_id is not null;
