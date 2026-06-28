-- Phase 13: additional admin read access for health dashboard.

drop policy if exists "mb_quota_log select admin" on public.mb_quota_log;
create policy "mb_quota_log select admin" on public.mb_quota_log
  for select to authenticated using (public.is_admin());
