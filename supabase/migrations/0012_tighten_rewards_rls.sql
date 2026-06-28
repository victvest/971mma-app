-- Phase 7 hardening: clients may read rewards state and call redeem_reward,
-- but they must never directly mutate the points/rewards engine-owned rows.

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'points_accounts',
        'points_ledger',
        'member_milestones',
        'redemptions',
        'discipline_scores'
      )
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

drop policy if exists "points_accounts select own" on public.points_accounts;
create policy "points_accounts select own" on public.points_accounts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "points_ledger select own" on public.points_ledger;
create policy "points_ledger select own" on public.points_ledger
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "member_milestones select own" on public.member_milestones;
create policy "member_milestones select own" on public.member_milestones
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "redemptions select own" on public.redemptions;
create policy "redemptions select own" on public.redemptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "discipline_scores select own" on public.discipline_scores;
create policy "discipline_scores select own" on public.discipline_scores
  for select to authenticated using (auth.uid() = user_id);
