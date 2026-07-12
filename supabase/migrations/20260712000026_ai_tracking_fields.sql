-- Richer tracking data for the AI features:
--   · sleep context (where, and how the baby settled) — sleep coaching later
--   · post-feed signals (spit-up, how settled) — turns "what happened" into
--     "how it went", which is what feeding questions are actually about
--   · length + head circumference on a weight entry (measured together at
--     clinic; weight entries become "measurements")
--   · temperature and milestones as new entry types
--   · medications can now be the baby's, not just the mother's
--   · ai_prefill: what the vision model suggested for a nappy, kept alongside
--     what the parent actually saved — the correction loop that trains it
alter type entry_type add value if not exists 'temperature';
alter type entry_type add value if not exists 'milestone';

alter table entries
  add column if not exists sleep_location text,   -- cot|arms|pram|car_seat|next_to_me|other
  add column if not exists settle_method text,    -- self|fed|rocked|dummy|other
  add column if not exists spit_up boolean,       -- feed: brought some milk back up
  add column if not exists post_feed_mood text,   -- settled|fussy|crying
  add column if not exists length_mm integer,     -- measured with a weight entry
  add column if not exists head_circ_mm integer,  -- measured with a weight entry
  add column if not exists temp_c numeric(4,1),   -- type = temperature
  add column if not exists milestone_label text,  -- type = milestone
  add column if not exists med_subject text,      -- mother|baby (null = mother, legacy)
  add column if not exists ai_prefill jsonb;      -- vision suggestion for a nappy
