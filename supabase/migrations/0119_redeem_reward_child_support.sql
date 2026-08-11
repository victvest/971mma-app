-- Migration 0119: Support child profile reward redemptions
DROP FUNCTION IF EXISTS public.redeem_reward(uuid);

CREATE OR REPLACE FUNCTION public.redeem_reward(p_reward uuid, p_user uuid default null)
RETURNS public.redemptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_user uuid := auth.uid();
  v_user uuid := coalesce(p_user, v_auth_user);
  v_account public.points_balance_cache%ROWTYPE;
  v_reward public.rewards_catalog%ROWTYPE;
  v_redemption public.redemptions%ROWTYPE;
  v_required_tier text;
  v_tier_rank int;
  v_required_rank int;
  v_redemption_count int := 0;
BEGIN
  if v_auth_user is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  -- Ensure authenticated user can write to/manage the target user's rewards
  if v_user <> v_auth_user and not public.is_approved_guardian_of(v_user) and not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  perform public.rebuild_points_balance_cache(v_user);

  select *
    into v_account
  from public.points_balance_cache
  where user_id = v_user
  for update;

  select *
    into v_reward
  from public.rewards_catalog
  where id = p_reward
  for update;

  if not found
    or not v_reward.active
    or v_reward.deleted_at is not null
    or coalesce((v_reward.unlock_rule ->> 'placeholder')::boolean, false) = true
    or (v_reward.available_from is not null and v_reward.available_from > now())
    or (v_reward.available_until is not null and v_reward.available_until < now()) then
    raise exception using message = 'REWARD_UNAVAILABLE', errcode = 'P0001';
  end if;

  if v_reward.inventory is not null and v_reward.inventory <= 0 then
    raise exception using message = 'OUT_OF_STOCK', errcode = 'P0001';
  end if;

  if v_reward.max_per_user is not null then
    select count(*)::int
      into v_redemption_count
    from public.redemptions
    where user_id = v_user
      and reward_id = v_reward.id
      and status in ('pending', 'fulfilled');

    if v_redemption_count >= v_reward.max_per_user then
      raise exception using message = 'REDEMPTION_LIMIT_REACHED', errcode = 'P0001';
    end if;
  end if;

  v_required_tier := v_reward.unlock_rule ->> 'requiresTier';
  if v_required_tier is not null then
    v_tier_rank := case v_account.tier when 'gold' then 3 when 'silver' then 2 else 1 end;
    v_required_rank := case v_required_tier when 'gold' then 3 when 'silver' then 2 else 1 end;
    if v_tier_rank < v_required_rank then
      raise exception using message = 'REWARD_LOCKED', errcode = 'P0001';
    end if;
  end if;

  if v_account.balance < v_reward.cost_points then
    raise exception using message = 'INSUFFICIENT_POINTS', errcode = 'P0001';
  end if;

  if v_reward.inventory is not null then
    update public.rewards_catalog
    set inventory = inventory - 1,
        updated_at = now()
    where id = v_reward.id;
  end if;

  insert into public.redemptions (user_id, reward_id, cost_points, status, fulfilled_at)
  values (v_user, v_reward.id, v_reward.cost_points, 'pending', null)
  returning * into v_redemption;

  perform public.post_points_transaction(
    v_user,
    -v_reward.cost_points,
    'redeem',
    'redemptions',
    v_redemption.id,
    'redeem:' || v_redemption.id::text,
    jsonb_build_object('rewardName', v_reward.name)
  );

  return v_redemption;
END;
$$;

revoke execute on function public.redeem_reward(uuid, uuid) from public, anon;
grant execute on function public.redeem_reward(uuid, uuid) to authenticated;
