-- Migration: 0052_profiles_update_policy.sql
-- Add update policy for profiles to allow users to update their own profile info.

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
