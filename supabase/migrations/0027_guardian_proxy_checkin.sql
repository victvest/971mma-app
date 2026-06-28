-- Guardian-proxy check-ins: audit who presented the QR; points only after coach confirms at scan time.

alter table public.check_ins
  add column if not exists presented_by uuid references auth.users(id) on delete set null;

comment on column public.check_ins.presented_by is
  'Guardian who displayed this member QR. Null when the member showed their own code.';

create index if not exists idx_check_ins_presented_by_day
  on public.check_ins (presented_by, checked_in_at desc)
  where presented_by is not null;

-- Points / progress helpers: guardian-proxy rows only count when coach confirmed at scan (see mb-checkin).
-- presented_by is audit-only after confirmation; no separate coach_verified column needed.

create or replace function public.award_check_in_points(p_user uuid, p_checkin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance int;
  v_lifetime int;
  v_new_balance int;
  v_new_lifetime int;
  v_tier text;
begin
  if p_user is null or p_checkin is null then
    return;
  end if;

  if exists (
    select 1
    from public.check_ins
    where id = p_checkin
      and (missed = true or late_cancelled = true)
  ) then
    return;
  end if;

  insert into public.points_accounts (user_id, balance, tier, lifetime_points, updated_at)
  values (p_user, 0, 'bronze', 0, now())
  on conflict (user_id) do nothing;

  select balance, lifetime_points
    into v_balance, v_lifetime
  from public.points_accounts
  where user_id = p_user
  for update;

  if exists (
    select 1
    from public.points_ledger
    where reason = 'check_in'
      and ref_id = p_checkin
  ) then
    return;
  end if;

  v_new_balance := v_balance + 10;
  v_new_lifetime := v_lifetime + 10;
  v_tier := case
    when v_new_lifetime >= 4000 then 'gold'
    when v_new_lifetime >= 1500 then 'silver'
    else 'bronze'
  end;

  update public.points_accounts
  set balance = v_new_balance,
      lifetime_points = v_new_lifetime,
      tier = v_tier,
      updated_at = now()
  where user_id = p_user;

  insert into public.points_ledger (user_id, delta, reason, ref_id, balance_after)
  values (p_user, 10, 'check_in', p_checkin, v_new_balance)
  on conflict (reason, ref_id) where ref_id is not null do nothing;
end;
$$;
