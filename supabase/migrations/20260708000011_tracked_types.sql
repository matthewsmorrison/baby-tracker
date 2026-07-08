-- Which categories a family wants to track. Defaults to all four.
alter table babies
  add column tracked_types text[] not null default '{nappy,feed,sleep,weight}';
