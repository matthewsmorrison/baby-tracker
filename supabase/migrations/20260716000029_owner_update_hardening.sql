-- Owners could PATCH any column on their babies row through the REST API —
-- including membership_tier, self-upgrading to the paid Advanced tier. RLS is
-- row-level; restrict WHICH columns are writable with column privileges. The
-- app's owner-editable settings are exactly this list (updateBabySetting +
-- updateTrackedTypes); membership_tier and referred_by_pro are operator-set.
revoke update on table babies from anon, authenticated;
grant update (name, birth_at, birth_weight_g, sex, nappy_base_weight_g,
              feed_interval_min, tracked_types)
  on table babies to authenticated;

-- Belt and braces on UPDATE policies that had USING only: Postgres reuses
-- USING as the check, but make the row-stays-in-scope rule explicit.
alter policy "editor updates messages" on chat_messages
  with check (
    exists (
      select 1 from chat_conversations c
      where c.id = conversation_id and can_edit_baby(c.baby_id)
    )
  );
alter policy "editor updates notes" on baby_notes
  with check (can_edit_baby(baby_id));
