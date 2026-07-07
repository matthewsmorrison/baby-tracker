-- Security hardening (from security review, 2026-07-07)

-- Owners cannot delete their own membership row: leaving would orphan the
-- baby. Owners delete the baby, or transfer ownership, instead.
alter policy "member leaves baby" on baby_members
  using (user_id = auth.uid() and role <> 'owner');
