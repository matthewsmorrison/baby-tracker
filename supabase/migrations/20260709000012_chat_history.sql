-- Saved Ask conversations, so a parent can return to earlier chats.
-- Private to the carer who created them (each carer sees only their own),
-- scoped to a baby so switching baby filters the list.
create table chat_conversations (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies on delete cascade,
  title text,
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_conversations_owner_idx
  on chat_conversations (created_by, baby_id, updated_at desc);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_conversation_idx
  on chat_messages (conversation_id, created_at);

alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;

-- Conversations: only the creating carer can see or touch them.
create policy "owner reads conversations" on chat_conversations
  for select using (created_by = auth.uid() and is_baby_member(baby_id));
create policy "owner inserts conversations" on chat_conversations
  for insert with check (created_by = auth.uid() and can_edit_baby(baby_id));
create policy "owner updates conversations" on chat_conversations
  for update using (created_by = auth.uid());
create policy "owner deletes conversations" on chat_conversations
  for delete using (created_by = auth.uid());

-- Messages: gated through the parent conversation's owner.
create policy "owner reads messages" on chat_messages
  for select using (
    exists (
      select 1 from chat_conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );
create policy "owner inserts messages" on chat_messages
  for insert with check (
    exists (
      select 1 from chat_conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );
create policy "owner deletes messages" on chat_messages
  for delete using (
    exists (
      select 1 from chat_conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );

create trigger chat_conversations_updated_at before update on chat_conversations
  for each row execute function set_updated_at();
