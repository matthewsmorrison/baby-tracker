-- Stream message inserts (new messages) and updates (read receipts) to
-- subscribed clients. RLS still applies: realtime only delivers rows the
-- subscriber is allowed to select, so users only ever receive their own
-- conversations. Typing indicators use ephemeral broadcast channels and
-- need no schema.
alter publication supabase_realtime add table messages;
