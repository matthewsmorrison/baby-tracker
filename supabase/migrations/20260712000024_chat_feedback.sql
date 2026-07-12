-- Thumbs up/down on Bea's answers — the feedback loop that tells us whether
-- her answers are any good. Stored on the message itself; any carer can rate
-- (chats are already shared across the family).
alter table chat_messages add column if not exists feedback text
  check (feedback in ('up', 'down'));

create policy "editor updates messages" on chat_messages
  for update using (
    exists (
      select 1 from chat_conversations c
      where c.id = conversation_id and can_edit_baby(c.baby_id)
    )
  );
