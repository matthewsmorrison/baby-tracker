-- Combined feed entries: one feed can include left/right breast minutes,
-- expressed ml and formula ml together, with an optional end time and a
-- per-component note (e.g. "latched well", "breast still sore after feed").

alter table entries
  add column ended_at timestamptz,        -- feed end; occurred_at is the start
  add column expressed_ml integer,
  add column formula_ml integer,
  add column feed_notes jsonb;            -- { left, right, expressed, formula }

-- Migrate existing single-type bottle feeds into the split columns.
update entries set expressed_ml = volume_ml
  where type = 'feed' and feed_type = 'expressed' and volume_ml is not null;
update entries set formula_ml = volume_ml
  where type = 'feed' and feed_type = 'formula' and volume_ml is not null;
