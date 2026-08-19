-- getBabyContext runs on every page view and filters baby_members by
-- user_id alone; the only existing index leads on baby_id, so that lookup
-- seq-scanned — with the RLS membership function evaluated per row.
create index baby_members_user_idx on baby_members (user_id);
