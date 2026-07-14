-- The nappy photo analyser was removed (again) — drop its column.
alter table entries drop column if exists ai_prefill;
