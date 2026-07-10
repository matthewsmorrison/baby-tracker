-- AI photo labelling has been removed; drop the stored analysis column.
alter table entries drop column if exists ai;
