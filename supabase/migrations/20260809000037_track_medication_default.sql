-- Medicines now log through the + modal like everything else (they used to
-- be Profile-only). Track them by default so the Meds tab is discoverable;
-- families who don't want it can turn it off in Settings → What to track.
alter table babies alter column tracked_types
  set default '{nappy,feed,sleep,weight,medication}';

update babies
  set tracked_types = array_append(tracked_types, 'medication')
  where not ('medication' = any(tracked_types));
