-- Photos attached to a note or question. Stored in the nappy-photos bucket
-- under {baby_id}/note-{note_id}-*.jpg so the existing baby-scoped storage
-- RLS and cleanup apply.
alter table baby_notes add column if not exists photo_paths text[];
