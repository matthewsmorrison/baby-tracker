-- Let a signed-in user create and edit their OWN professional profile
-- (self-serve sign-up). Public read stays; claiming an unlinked row by email
-- is still done with the service role.
create policy "user creates own professional" on professionals
  for insert with check (user_id = auth.uid());
create policy "user updates own professional" on professionals
  for update using (user_id = auth.uid());
