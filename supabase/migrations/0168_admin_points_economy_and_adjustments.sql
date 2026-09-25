-- Migration 0168: Points Economy Settings & Manual Member Points Adjustments

-- 1. Add check_in_points to app_settings
alter table public.app_settings
  add column if not exists check_in_points int not null default 10
    check (check_in_points >= 0);

update public.app_settings
set check_in_points = 10
where check_in_points is null;

-- 2. Helper for check-in points
create or replace function public.get_check_in_points()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select check_in_points from public.app_settings where id = 1),
    10
  );
$$;

revoke all on function public.get_check_in_points() from public, anon;
grant execute on function public.get_check_in_points() to authenticated;

-- 3. Update get_app_settings RPC
create or replace function public.get_app_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'showRewardPrices', coalesce(s.show_reward_prices, true),
    'referralBonusPoints', coalesce(s.referral_bonus_points, 250),
    'checkInPoints', coalesce(s.check_in_points, 10),
    'updatedAt', s.updated_at
  )
  from (select 1) _
  left join public.app_settings s on s.id = 1;
$$;

revoke all on function public.get_app_settings() from public, anon;
grant execute on function public.get_app_settings() to authenticated;

-- 4. Update admin_update_app_settings RPC
create or replace function public.admin_update_app_settings(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.app_settings%rowtype;
begin
  perform public.require_admin();

  if p_payload is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  insert into public.app_settings (id, show_reward_prices, referral_bonus_points, check_in_points, updated_at, updated_by)
  values (1, true, 250, 10, now(), auth.uid())
  on conflict (id) do nothing;

  update public.app_settings
  set show_reward_prices = coalesce(
        (p_payload ->> 'show_reward_prices')::boolean,
        show_reward_prices
      ),
      referral_bonus_points = coalesce(
        (p_payload ->> 'referral_bonus_points')::int,
        referral_bonus_points
      ),
      check_in_points = coalesce(
        (p_payload ->> 'check_in_points')::int,
        check_in_points
      ),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1
  returning * into v_row;

  if v_row.referral_bonus_points is null or v_row.referral_bonus_points <= 0 then
    raise exception using message = 'INVALID_REFERRAL_BONUS', errcode = 'P0001';
  end if;

  if v_row.check_in_points is null or v_row.check_in_points < 0 then
    raise exception using message = 'INVALID_CHECK_IN_POINTS', errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'showRewardPrices', v_row.show_reward_prices,
    'referralBonusPoints', v_row.referral_bonus_points,
    'checkInPoints', v_row.check_in_points,
    'updatedAt', v_row.updated_at
  );
end;
$$;

revoke all on function public.admin_update_app_settings(jsonb) from public, anon;
grant execute on function public.admin_update_app_settings(jsonb) to authenticated;

-- 5. Update award_check_in_points to use dynamic check_in_points setting
create or replace function public.award_check_in_points(
  p_user uuid,
  p_checkin uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method text;
  v_gym_day date;
  v_points int;
begin
  if p_user is null or p_checkin is null then
    return;
  end if;

  if exists (
    select 1
    from public.points_ledger
    where user_id = p_user
      and reason = 'check_in'
      and ref_id = p_checkin
  ) then
    return;
  end if;

  select method, gym_day
    into v_method, v_gym_day
  from public.check_ins
  where id = p_checkin;

  if v_method in ('gate_scan', 'qr_scan') and v_gym_day is not null then
    if exists (
      select 1
      from public.check_ins
      where user_id = p_user
        and gym_day = v_gym_day
        and method in ('gate_scan', 'qr_scan')
        and id <> p_checkin
        and checked_in_at < (
          select checked_in_at from public.check_ins where id = p_checkin
        )
    ) then
      return;
    end if;
  end if;

  v_points := public.get_check_in_points();

  if v_points > 0 then
    perform public.post_points_transaction(
      p_user,
      v_points,
      'check_in',
      'check_ins',
      p_checkin,
      'check_in:' || p_checkin::text,
      jsonb_build_object('source', 'attendance', 'pointsAwarded', v_points)
    );
  end if;
end;
$$;

revoke execute on function public.award_check_in_points(uuid, uuid) from public, anon, authenticated;

-- 6. RPC: admin_adjust_member_points
create or replace function public.admin_adjust_member_points(
  p_user_id uuid,
  p_delta int,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger public.points_ledger;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  perform public.require_admin();

  if p_user_id is null or p_delta = 0 then
    raise exception using message = 'INVALID_DELTA', errcode = 'P0001';
  end if;

  if v_reason = '' then
    raise exception using message = 'REASON_REQUIRED', errcode = 'P0001';
  end if;

  v_ledger := public.post_points_transaction(
    p_user_id,
    p_delta,
    'adjustment',
    null,
    null,
    null,
    jsonb_build_object(
      'adminReason', v_reason,
      'adjustedBy', auth.uid(),
      'adjustedAt', now()
    )
  );

  return jsonb_build_object(
    'userId', p_user_id,
    'delta', p_delta,
    'balanceAfter', v_ledger.balance_after,
    'reason', v_reason
  );
end;
$$;

revoke all on function public.admin_adjust_member_points(uuid, int, text) from public, anon;
grant execute on function public.admin_adjust_member_points(uuid, int, text) to authenticated;
