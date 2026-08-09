-- Social polish: blocking, waves, read-receipt privacy, and status lines.

-- BLOCKING --------------------------------------------------------------------
-- A friendship row can now be 'blocked'; blocked_by records who did it.
alter table friendships drop constraint if exists friendships_status_check;
alter table friendships add constraint friendships_status_check
  check (status in ('pending', 'accepted', 'blocked'));
alter table friendships add column if not exists blocked_by uuid references profiles;

-- Either party may flip a row to blocked (the WITH CHECK stops a requester
-- from using this policy to self-accept).
create policy "party blocks" on friendships for update
  using (auth.uid() in (requester, addressee))
  with check (status = 'blocked' and blocked_by = auth.uid());

-- The blockee must not be able to delete the block row and re-request.
drop policy "party removes friendship" on friendships;
create policy "party removes friendship" on friendships for delete
  using (
    auth.uid() in (requester, addressee)
    and (status <> 'blocked' or blocked_by = auth.uid())
  );

grant update (status, accepted_at, blocked_by) on table friendships to authenticated;

-- Someone you've blocked loses sight of your profile (presence, status,
-- avatar); you keep sight of theirs so your Blocked list can render.
create or replace function has_friendship(a uuid, b uuid) returns boolean
  language sql security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where ((requester = a and addressee = b) or (requester = b and addressee = a))
      and (status <> 'blocked' or blocked_by = a)
  );
$$;

-- WAVES & READ-RECEIPT PRIVACY --------------------------------------------------
-- kind marks one-tap waves (body is still an encrypted "👋" envelope).
-- receipt_suppressed is set by a reader whose read-receipts are off: unread
-- clearing still works, but the sender's UI won't show "Seen".
alter table messages add column if not exists kind text not null default 'text'
  check (kind in ('text', 'wave'));
alter table messages add column if not exists receipt_suppressed boolean not null default false;
grant update (read_at, receipt_suppressed) on table messages to authenticated;

alter table user_settings add column if not exists read_receipts boolean not null default true;

-- STATUS LINE -------------------------------------------------------------------
alter table profiles add column if not exists status_text text
  check (status_text is null or char_length(status_text) <= 80);
