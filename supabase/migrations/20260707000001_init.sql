-- Hearth newborn tracker — initial schema, RLS, storage
-- Apply with: supabase db push (linked project) or paste into the SQL editor.

-- ENUMS
create type member_role as enum ('owner','caregiver','viewer');
create type entry_type  as enum ('nappy','feed','weight');
create type invite_status as enum ('pending','accepted','revoked');

-- PROFILES (mirror of auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  avatar_url text,
  email text,
  created_at timestamptz not null default now()
);

-- Keep profiles in sync with auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    email = excluded.email;
  return new;
end $$;

create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

-- BABIES
create table babies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_at timestamptz not null,          -- drives day-of-life
  birth_weight_g integer not null,
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now()
);

-- MEMBERSHIP (multi-carer + read-only healthcare)
create table baby_members (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role member_role not null default 'caregiver',
  created_at timestamptz not null default now(),
  unique (baby_id, user_id)
);

-- Creating a baby makes the creator its owner, atomically
create or replace function public.handle_new_baby()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.baby_members (baby_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end $$;

create trigger on_baby_created
  after insert on babies
  for each row execute function public.handle_new_baby();

-- INVITES (email-based)
create table baby_invites (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies on delete cascade,
  email text not null,
  role member_role not null default 'caregiver',
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references auth.users,
  status invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index baby_invites_token_idx on baby_invites (token);
create index baby_invites_email_idx on baby_invites (lower(email));

-- ENTRIES (nappies + feeds + weights)
create table entries (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies on delete cascade,
  type entry_type not null,
  occurred_at timestamptz not null,        -- EDITABLE; supports backdating
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- nappy
  wet boolean,
  dirty boolean,
  stool_colour text,        -- meconium|transitional|yellow|tan|brown|green|pale|blood

  -- feed
  feed_type text,           -- breast|formula|expressed
  left_min integer,
  right_min integer,
  volume_ml integer,        -- formula or expressed

  -- weight
  weight_g integer,

  -- shared
  note text,
  photo_path text,          -- storage object path for nappy image
  ai jsonb                  -- Claude analysis result
);

create index entries_baby_time_idx on entries (baby_id, occurred_at desc);
create index entries_baby_type_time_idx on entries (baby_id, type, occurred_at desc);

-- updated_at trigger
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger entries_updated_at before update on entries
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table babies enable row level security;
alter table baby_members enable row level security;
alter table baby_invites enable row level security;
alter table entries enable row level security;

-- SECURITY DEFINER helpers avoid recursive policy evaluation
create or replace function is_baby_member(bid uuid) returns boolean
  language sql security definer set search_path = public as $$
  select exists (select 1 from baby_members
                 where baby_id = bid and user_id = auth.uid());
$$;

create or replace function can_edit_baby(bid uuid) returns boolean
  language sql security definer set search_path = public as $$
  select exists (select 1 from baby_members
                 where baby_id = bid and user_id = auth.uid()
                   and role in ('owner','caregiver'));
$$;

create or replace function is_baby_owner(bid uuid) returns boolean
  language sql security definer set search_path = public as $$
  select exists (select 1 from baby_members
                 where baby_id = bid and user_id = auth.uid() and role = 'owner');
$$;

-- profiles: readable by self and by co-members (to show names in Members list)
create policy "own profile read"  on profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from baby_members mine
    join baby_members theirs on theirs.baby_id = mine.baby_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
create policy "own profile write" on profiles for update using (id = auth.uid());
create policy "own profile insert" on profiles for insert with check (id = auth.uid());

-- babies
create policy "member reads baby"   on babies for select using (is_baby_member(id));
create policy "owner updates baby"  on babies for update using (is_baby_owner(id));
create policy "creator inserts baby" on babies for insert with check (created_by = auth.uid());
create policy "owner deletes baby"  on babies for delete using (is_baby_owner(id));

-- baby_members
create policy "member reads members" on baby_members for select using (is_baby_member(baby_id));
create policy "owner manages members" on baby_members for all
  using (is_baby_owner(baby_id)) with check (is_baby_owner(baby_id));
create policy "member leaves baby" on baby_members for delete
  using (user_id = auth.uid());
-- note: the first owner row is inserted by the on_baby_created trigger;
-- invite acceptance inserts memberships server-side with the service role.

-- entries: viewers can read but NOT write
create policy "member reads entries"  on entries for select using (is_baby_member(baby_id));
create policy "editor inserts entries" on entries for insert with check (can_edit_baby(baby_id));
create policy "editor updates entries" on entries for update using (can_edit_baby(baby_id));
create policy "editor deletes entries" on entries for delete using (can_edit_baby(baby_id));

-- invites: owner manages; invitee can read by matching email
create policy "owner manages invites" on baby_invites for all
  using (is_baby_owner(baby_id)) with check (is_baby_owner(baby_id));
create policy "invitee reads own invite" on baby_invites for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- ---------------------------------------------------------------------------
-- STORAGE: private nappy-photos bucket, paths are {baby_id}/{entry_id}.jpg
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nappy-photos', 'nappy-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "member reads nappy photos" on storage.objects for select
  using (
    bucket_id = 'nappy-photos'
    and is_baby_member((storage.foldername(name))[1]::uuid)
  );

create policy "editor uploads nappy photos" on storage.objects for insert
  with check (
    bucket_id = 'nappy-photos'
    and can_edit_baby((storage.foldername(name))[1]::uuid)
  );

create policy "editor updates nappy photos" on storage.objects for update
  using (
    bucket_id = 'nappy-photos'
    and can_edit_baby((storage.foldername(name))[1]::uuid)
  );

create policy "editor deletes nappy photos" on storage.objects for delete
  using (
    bucket_id = 'nappy-photos'
    and can_edit_baby((storage.foldername(name))[1]::uuid)
  );
