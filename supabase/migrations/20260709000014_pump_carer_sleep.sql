-- Two optional trackers:
--   pump        — a breast-pumping session (helps optimise when to pump)
--   carer_sleep — a carer's own sleep, so parents can track their rest
-- Both reuse existing entry columns rather than adding new ones:
--   expressed_ml = volume pumped, ended_at = session/sleep end,
--   created_by = which carer. Just extend the entry_type enum.
alter type entry_type add value if not exists 'pump';
alter type entry_type add value if not exists 'carer_sleep';
