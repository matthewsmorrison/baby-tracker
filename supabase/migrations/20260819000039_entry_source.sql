-- Provenance for bulk-imported entries. Hand-logged entries keep source null;
-- an import stamps its origin (e.g. 'huckleberry') so a bad import can be
-- removed cleanly without touching anything logged by hand.
alter table entries
  add column source text check (source is null or char_length(source) <= 40);

-- Imports dedupe and undo by (baby, source) — keep that cheap.
create index entries_source_idx on entries (baby_id, source)
  where source is not null;
