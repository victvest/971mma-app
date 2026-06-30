-- Coach front-desk tools: members can activate, rewards pickup, activation queue.
-- Ops-only config (curriculum, roles, sync) stays in the admin console.

create or replace function public.coach_list_pending_redemptions(
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  reward_id uuid,
  reward_name text,
  member_name text,
  member_email text,
  cost_points int,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select
    r.id,
    r.user_id,
    r.reward_id,
    rc.name as reward_name,
    coalesce(p.full_name, 'Member') as member_name,
    u.email::text as member_email,
    r.cost_points,
    r.status,
    r.created_at
  from public.redemptions r
  join public.rewards_catalog rc on rc.id = r.reward_id
  join public.profiles p on p.id = r.user_id
  join auth.users u on u.id = r.user_id
  where r.status = 'pending'
  order by r.created_at asc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.coach_fulfill_redemption(p_redemption_id uuid)
returns public.redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemption public.redemptions%rowtype;
begin
  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select *
    into v_redemption
  from public.redemptions
  where id = p_redemption_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_redemption.status <> 'pending' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  update public.redemptions
  set status = 'fulfilled',
      fulfilled_at = now()
  where id = p_redemption_id
  returning * into v_redemption;

  return v_redemption;
end;
$$;

create or replace function public.coach_list_activation_requests(
  p_status text default 'pending',
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  status text,
  requested_at timestamptz,
  resolved_at timestamptz,
  full_name text,
  email text,
  phone text,
  account_status text,
  mindbody_client_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_status text := nullif(trim(coalesce(p_status, '')), '');
begin
  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select
    ar.id,
    ar.user_id,
    ar.status,
    ar.requested_at,
    ar.resolved_at,
    p.full_name,
    u.email::text,
    coalesce(ar.member_phone, p.phone) as phone,
    p.account_status,
    ml.mindbody_client_id
  from public.activation_requests ar
  join public.profiles p on p.id = ar.user_id
  join auth.users u on u.id = ar.user_id
  left join public.mindbody_links ml on ml.user_id = ar.user_id
  where v_status is null or ar.status = v_status
  order by
    case when ar.status = 'pending' then 0 else 1 end,
    ar.requested_at desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.coach_update_activation_request(
  p_id uuid,
  p_status text
)
returns public.activation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_row public.activation_requests;
begin
  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  v_status := coalesce(nullif(trim(p_status), ''), 'pending');
  if v_status not in ('pending', 'resolved', 'cancelled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  update public.activation_requests
  set
    status = v_status,
    resolved_at = case
      when v_status = 'resolved' then coalesce(resolved_at, now())
      else resolved_at
    end
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

create or replace function public.coach_get_member_desk_summary(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_user_id is null then
    raise exception 'BAD_REQUEST' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'userId', p.id,
    'fullName', coalesce(p.full_name, 'Member'),
    'email', u.email,
    'phone', p.phone,
    'accountStatus', p.account_status,
    'beltRank', coalesce(belt.rank_name, p.belt_rank),
    'beltStripes', coalesce(belt.stripe, p.belt_stripes),
    'membershipName', p.membership_name,
    'membershipStatus', p.membership_status,
    'membershipExpiresAt', p.membership_expires_at,
    'mindbodyClientId', ml.mindbody_client_id,
    'pointsBalance', coalesce(pp.balance, 0),
    'pendingActivationRequest', exists (
      select 1
      from public.activation_requests ar
      where ar.user_id = p.id
        and ar.status = 'pending'
    )
  )
  into v_row
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.mindbody_links ml on ml.user_id = p.id
  left join public.points_accounts pp on pp.user_id = p.id
  left join lateral (
    select mrp.stripe, rl.name as rank_name
    from public.member_rank_progress mrp
    join public.rank_levels rl on rl.id = mrp.rank_level_id
    join public.disciplines d on d.id = mrp.discipline_id
    where mrp.user_id = p.id
      and d.slug = 'bjj'
    limit 1
  ) belt on true
  where p.id = p_user_id;

  if v_row is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

revoke all on function public.coach_list_pending_redemptions(int, int) from public;
grant execute on function public.coach_list_pending_redemptions(int, int) to authenticated;

revoke all on function public.coach_fulfill_redemption(uuid) from public;
grant execute on function public.coach_fulfill_redemption(uuid) to authenticated;

revoke all on function public.coach_list_activation_requests(text, int, int) from public;
grant execute on function public.coach_list_activation_requests(text, int, int) to authenticated;

revoke all on function public.coach_update_activation_request(uuid, text) from public;
grant execute on function public.coach_update_activation_request(uuid, text) to authenticated;

revoke all on function public.coach_get_member_desk_summary(uuid) from public;
grant execute on function public.coach_get_member_desk_summary(uuid) to authenticated;
