-- Medication dose + reminders. Reminder times are local "HH:MM" strings with
-- the timezone they were set in, so the cron can fire a push at the right
-- local time. Reminders only fire while the course is active (started, not
-- yet stopped) and go to the carer who logged the medication.
alter table entries add column if not exists med_dose text;
alter table entries add column if not exists reminder_times text[];
alter table entries add column if not exists reminder_tz text;
