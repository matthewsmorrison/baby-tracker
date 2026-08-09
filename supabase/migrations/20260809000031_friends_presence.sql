-- Friends & presence: user-to-user friendships, direct messages between
-- friends, and an MSN-style presence signal ("online" / "feeding") that
-- friends can see. Presence is written by its owner and treated as offline
-- by clients once the heartbeat goes stale.

-- PRESENCE (on profiles; read via the profiles select policies).
-- public_key is the user's ECDH public key (JWK), published by the client so
-- friends can encrypt messages to them — see lib/e2ee.ts.
alter table profiles
  add column if not exists presence_status text not null default 'offline'
    check (presence_status in ('offline', 'online', 'feeding')),
  add column if not exists presence_at timestamptz,
  add column if not exists public_key text;

-- FRIENDSHIPS -----------------------------------------------------------------
create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references profiles (id) on delete cascade,
  addressee uuid not null references profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester <> addressee)
);

-- One row per pair, whichever direction the request was sent in.
create unique index friendships_pair_key
  on friendships ((least(requester, addressee)), (greatest(requester, addressee)));

alter table friendships enable row level security;

-- SECURITY DEFINER so profiles/messages policies can check friendship state
-- without recursive policy evaluation (same pattern as is_baby_member).
create or replace function are_friends(a uuid, b uuid) returns boolean
  language sql security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- Any friendship row (pending too — needed to show who a request is from).
create or replace function has_friendship(a uuid, b uuid) returns boolean
  language sql security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where (requester = a and addressee = b) or (requester = b and addressee = a)
  );
$$;

create policy "party reads friendship" on friendships for select
  using (auth.uid() in (requester, addressee));
create policy "user sends request" on friendships for insert
  with check (requester = auth.uid() and status = 'pending');
create policy "addressee accepts" on friendships for update
  using (addressee = auth.uid()) with check (addressee = auth.uid());
create policy "party removes friendship" on friendships for delete
  using (auth.uid() in (requester, addressee));

-- Accepting may only flip status/accepted_at — never rewrite who the
-- friendship is between (that would fabricate consent for the other party).
revoke update on table friendships from anon, authenticated;
grant update (status, accepted_at) on table friendships to authenticated;

-- Friends (and pending requesters/addressees) can see each other's profile,
-- which is also how presence travels.
create policy "friend reads profile" on profiles for select
  using (has_friendship(auth.uid(), id));

-- MESSAGES --------------------------------------------------------------------
-- body is an end-to-end-encrypted envelope (JSON: version, IV, ciphertext)
-- produced client-side; the server never sees plaintext. Sized for ~2000
-- chars of plaintext after base64 + envelope overhead.
create table messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references profiles (id) on delete cascade,
  recipient uuid not null references profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 8000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender <> recipient)
);

create index messages_pair_idx
  on messages ((least(sender, recipient)), (greatest(sender, recipient)), created_at);
create index messages_unread_idx on messages (recipient) where read_at is null;

alter table messages enable row level security;

create policy "party reads messages" on messages for select
  using (auth.uid() in (sender, recipient));
-- Only accepted friends can message each other.
create policy "friend sends message" on messages for insert
  with check (sender = auth.uid() and are_friends(sender, recipient));
create policy "recipient marks read" on messages for update
  using (recipient = auth.uid()) with check (recipient = auth.uid());

-- Read receipts only — a message body is immutable once sent.
revoke update on table messages from anon, authenticated;
grant update (read_at) on table messages to authenticated;
