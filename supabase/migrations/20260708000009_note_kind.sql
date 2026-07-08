-- Notes can be a plain note or a question (Q&A). Existing rows were Q&A.
alter table baby_notes
  add column kind text not null default 'question'
    check (kind in ('question', 'note'));
