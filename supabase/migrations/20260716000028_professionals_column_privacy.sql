-- professionals rows are public by design (profile pages), but the email
-- column is contact PII used only for account claiming (service role) — it
-- must not be readable through the anon/authenticated REST API. RLS is
-- row-level only, so use column privileges: revoke the blanket grant and
-- re-grant every column except email. (New columns added later will need an
-- explicit grant here too — which is the safe default.)
revoke select on table professionals from anon, authenticated;
grant select (id, slug, invite_code, name, title, bio, location, website, user_id, created_at)
  on table professionals to anon, authenticated;
