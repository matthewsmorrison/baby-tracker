-- The single FOR ALL "owner manages members" policy also permitted an owner
-- to delete their own membership (RLS policies are OR'd), which the earlier
-- "member leaves baby" restriction couldn't override — an owner could orphan
-- the baby. Split it so owners manage OTHERS but cannot delete themselves.
-- (Deleting the baby still removes everyone via FK cascade, which bypasses RLS.)
drop policy if exists "owner manages members" on baby_members;

create policy "owner inserts members" on baby_members for insert
  with check (is_baby_owner(baby_id));
create policy "owner updates members" on baby_members for update
  using (is_baby_owner(baby_id)) with check (is_baby_owner(baby_id));
create policy "owner removes other members" on baby_members for delete
  using (is_baby_owner(baby_id) and user_id <> auth.uid());
