-- Baby sex, for sex-specific WHO weight-for-age centiles.
alter table babies add column if not exists sex text check (sex in ('boy', 'girl'));
