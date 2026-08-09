-- The professionals feature (partner profiles, referral links, attribution)
-- has been removed from the product. Drop the attribution column and the
-- table; existing viewer memberships created via referrals are untouched.
alter table babies drop column if exists referred_by_pro;
drop table if exists professionals;
