-- Partner professionals (lactation consultants, midwives, NCT teachers…).
-- Each has a public profile page and a short invite code parents can use, so
-- sign-ups can be attributed to the professional who referred them.
-- Rows are managed by the operator (service role); publicly readable so the
-- /pro/[slug] page renders for logged-out visitors.
create table professionals (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  invite_code text not null unique,
  name text not null,
  title text not null,          -- e.g. "IBCLC Lactation Consultant"
  bio text,
  location text,
  website text,
  created_at timestamptz not null default now()
);
create index professionals_invite_code_idx on professionals (lower(invite_code));

alter table professionals enable row level security;
create policy "anyone reads professionals" on professionals for select using (true);

-- Which professional referred a baby's family (attribution). Nullable.
alter table babies add column if not exists referred_by_pro uuid references professionals;
