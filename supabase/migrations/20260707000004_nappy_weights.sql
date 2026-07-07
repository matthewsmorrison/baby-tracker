-- Nappy weighing: record the used nappy's weight per entry and the dry
-- ("base") nappy weight per baby; wetness is inferred from the difference.

alter table babies
  add column nappy_base_weight_g integer;   -- weight of a clean, dry nappy

alter table entries
  add column nappy_weight_g integer;        -- weight of the used nappy
