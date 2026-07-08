-- Membership tiers: AI features (photo labelling, Ask chat) are Advanced.
-- Every existing baby defaults to free.
alter table babies
  add column membership_tier text not null default 'free'
    check (membership_tier in ('free', 'advanced'));
