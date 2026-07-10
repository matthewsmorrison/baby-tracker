-- Optional tracker: the mother's medication, so trends can be spotted
-- (e.g. iron supplements often make stool darker/greener). Modelled as a
-- course: occurred_at = started, ended_at = stopped (null = still taking),
-- med_name = the medication, note = dose/details.
alter type entry_type add value if not exists 'medication';
alter table entries add column if not exists med_name text;
