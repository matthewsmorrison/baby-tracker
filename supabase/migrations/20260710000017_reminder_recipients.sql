-- Who receives a medication's reminders (one or more carers). Null/empty
-- falls back to the carer who logged it.
alter table entries add column if not exists reminder_user_ids uuid[];
