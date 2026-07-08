-- Configurable expected time between feeds; "Next feed due" only shows when set.
alter table babies
  add column feed_interval_min integer;   -- e.g. 180 = every 3 hours
