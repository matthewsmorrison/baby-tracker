-- Chat history is shared across all carers of a baby (like notes), rather
-- than private to whoever started it. Repoint the policies to baby
-- membership, and default created_by so inserts don't need to set it.
alter table chat_conversations alter column created_by set default auth.uid();

drop policy "owner reads conversations" on chat_conversations;
drop policy "owner inserts conversations" on chat_conversations;
drop policy "owner updates conversations" on chat_conversations;
drop policy "owner deletes conversations" on chat_conversations;

create policy "member reads conversations" on chat_conversations
  for select using (is_baby_member(baby_id));
create policy "editor inserts conversations" on chat_conversations
  for insert with check (can_edit_baby(baby_id));
create policy "editor updates conversations" on chat_conversations
  for update using (can_edit_baby(baby_id));
create policy "editor deletes conversations" on chat_conversations
  for delete using (can_edit_baby(baby_id));

drop policy "owner reads messages" on chat_messages;
drop policy "owner inserts messages" on chat_messages;
drop policy "owner deletes messages" on chat_messages;

create policy "member reads messages" on chat_messages
  for select using (
    exists (
      select 1 from chat_conversations c
      where c.id = conversation_id and is_baby_member(c.baby_id)
    )
  );
create policy "editor inserts messages" on chat_messages
  for insert with check (
    exists (
      select 1 from chat_conversations c
      where c.id = conversation_id and can_edit_baby(c.baby_id)
    )
  );
create policy "editor deletes messages" on chat_messages
  for delete using (
    exists (
      select 1 from chat_conversations c
      where c.id = conversation_id and can_edit_baby(c.baby_id)
    )
  );
