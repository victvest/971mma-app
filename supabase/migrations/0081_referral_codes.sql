-- Referral program v2: shareable member code, friend applies before activation, both earn on activation.

alter table public.profiles
  add column if not exists referral_code text;

create unique index if not exists idx_profiles_referral_code
  on public.profiles (referral_code)
  where referral_code is not null;

create unique index if not exists idx_referrals_referred_user_active
  on public.referrals (referred_user_id)
  where referred_user_id is not null and status in ('pending', 'awarded');

create or replace function public.normalize_referral_code(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(trim(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g'));
$$;

create or replace function public.generate_referral_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_code text;
  v_attempt int := 0;
begin
  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (
      select 1 from public.profiles p where p.referral_code = v_code
    );
    v_attempt := v_attempt + 1;
    if v_attempt > 30 then
      raise exception using message = 'CODE_GEN_FAILED', errcode = 'P0001';
    end if;
  end loop;
  return v_code;
end;
$$;

create or replace function public.ensure_referral_code(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_status text;
begin
  if p_user is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  select referral_code, account_status
    into v_code, v_status
  from public.profiles
  where id = p_user;

  if v_status is distinct from 'active' then
    raise exception using message = 'NOT_ACTIVE', errcode = 'P0001';
  end if;

  if v_code is not null and v_code <> '' then
    return v_code;
  end if;

  v_code := public.generate_referral_code();

  update public.profiles
  set referral_code = v_code,
      updated_at = now()
  where id = p_user
    and referral_code is null;

  select referral_code into v_code from public.profiles where id = p_user;
  return v_code;
end;
$$;

create or replace function public.get_my_referral_code()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  return public.ensure_referral_code(auth.uid());
end;
$$;

create or replace function public.get_my_referral_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'applied', r.id is not null,
    'status', r.status,
    'referrerName', p.full_name
  )
  from (select auth.uid() as user_id) me
  left join public.referrals r
    on r.referred_user_id = me.user_id
   and r.status in ('pending', 'awarded')
  left join public.profiles p on p.id = r.referrer_user_id;
$$;

create or replace function public.apply_referral_code(p_code text)
returns public.referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_status text;
  v_referrer uuid;
  v_referrer_status text;
  v_row public.referrals%rowtype;
begin
  if v_user is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  v_code := public.normalize_referral_code(p_code);
  if v_code is null or length(v_code) < 4 then
    raise exception using message = 'INVALID_CODE', errcode = 'P0001';
  end if;

  select account_status
    into v_status
  from public.profiles
  where id = v_user;

  if v_status = 'active' then
    raise exception using message = 'ALREADY_ACTIVE', errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.referrals r
    where r.referred_user_id = v_user
      and r.status in ('pending', 'awarded')
  ) then
    raise exception using message = 'ALREADY_REFERRED', errcode = 'P0001';
  end if;

  select p.id, p.account_status
    into v_referrer, v_referrer_status
  from public.profiles p
  where p.referral_code = v_code
  limit 1;

  if v_referrer is null then
    raise exception using message = 'INVALID_CODE', errcode = 'P0001';
  end if;

  if v_referrer = v_user then
    raise exception using message = 'SELF_REFERRAL', errcode = 'P0001';
  end if;

  if v_referrer_status is distinct from 'active' then
    raise exception using message = 'REFERRER_INACTIVE', errcode = 'P0001';
  end if;

  insert into public.referrals (
    referrer_user_id,
    referred_user_id,
    status,
    metadata
  )
  values (
    v_referrer,
    v_user,
    'pending',
    jsonb_build_object('code', v_code, 'appliedAt', now())
  )
  returning * into v_row;

  return v_row;
end;
$$;

drop function if exists public.notify_member_referral_awarded(uuid, uuid);

create or replace function public.notify_member_referral_awarded(
  p_user uuid,
  p_referral_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_points int := 250;
begin
  if p_user is null or p_referral_id is null then
    return;
  end if;

  if not coalesce(public.notification_enabled(p_user, 'referral'), true) then
    return;
  end if;

  v_key := 'member_referral:' || p_role || ':' || p_user::text || ':' || p_referral_id::text;

  if exists (
    select 1
    from public.notifications n
    where n.user_id = p_user
      and n.type = 'reward'
      and n.payload->>'idempotencyKey' = v_key
  ) then
    return;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    p_user,
    'reward',
    jsonb_build_object(
      'title', case when p_role = 'referrer' then 'Referral bonus earned' else 'Welcome bonus earned' end,
      'body', '+' || v_points::text || ' points',
      'referralId', p_referral_id,
      'pointsAward', v_points,
      'url', '/(tabs)/rewards',
      'idempotencyKey', v_key
    )
  );
end;
$$;

create or replace function public.complete_pending_referral(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
  v_bonus int := 250;
begin
  if p_user is null then
    return;
  end if;

  select *
    into v_referral
  from public.referrals
  where referred_user_id = p_user
    and status = 'pending'
  order by created_at asc
  limit 1
  for update;

  if not found then
    return;
  end if;

  perform public.post_points_transaction(
    v_referral.referrer_user_id,
    v_bonus,
    'referral',
    'referrals',
    v_referral.id,
    'referral:referrer:' || v_referral.id::text,
    jsonb_build_object('role', 'referrer', 'referredUserId', v_referral.referred_user_id)
  );

  perform public.post_points_transaction(
    v_referral.referred_user_id,
    v_bonus,
    'referral',
    'referrals',
    v_referral.id,
    'referral:referred:' || v_referral.id::text,
    jsonb_build_object('role', 'referred', 'referrerUserId', v_referral.referrer_user_id)
  );

  update public.referrals
  set status = 'awarded',
      points_awarded_at = coalesce(points_awarded_at, now()),
      updated_at = now()
  where id = v_referral.id;

  perform public.notify_member_referral_awarded(v_referral.referrer_user_id, v_referral.id, 'referrer');
  perform public.notify_member_referral_awarded(v_referral.referred_user_id, v_referral.id, 'referred');
end;
$$;

create or replace function public.on_member_activated_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_status = 'active'
    and old.account_status is distinct from 'active' then
    begin
      perform public.ensure_referral_code(new.id);
    exception
      when others then
        raise warning 'Referral code generation failed for user %: %', new.id, sqlerrm;
    end;

    begin
      perform public.complete_pending_referral(new.id);
    exception
      when others then
        raise warning 'Referral completion failed for user %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_member_activated_referral on public.profiles;
create trigger trg_member_activated_referral
  after update of account_status on public.profiles
  for each row
  execute function public.on_member_activated_referral();

drop function if exists public.get_my_referrals();

create or replace function public.get_my_referrals()
returns table (
  id uuid,
  referred_user_id uuid,
  referred_name text,
  status text,
  points_awarded_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.referred_user_id,
    coalesce(p.full_name, 'New member') as referred_name,
    r.status,
    r.points_awarded_at,
    r.created_at,
    r.updated_at
  from public.referrals r
  left join public.profiles p on p.id = r.referred_user_id
  where r.referrer_user_id = auth.uid()
  order by r.created_at desc
  limit 25;
$$;

create or replace function public.on_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
begin
  perform public.award_check_in_points(new.user_id, new.id);

  begin
    perform public.recompute_streak(new.user_id);
    perform public.evaluate_milestones(new.user_id);
    perform public.recompute_discipline_score(new.user_id);

    for v_rec in
      select d.slug
      from public.member_disciplines md
      join public.disciplines d on d.id = md.discipline_id
      where md.user_id = new.user_id
        and md.active = true
        and d.has_rank_progression = true
    loop
      perform public.recompute_belt_progress(new.user_id, v_rec.slug);
    end loop;
  exception
    when others then
      raise warning 'Engagement recompute failed for user %: %', new.user_id, sqlerrm;
  end;

  if coalesce(new.signed_in, true) = true
    and coalesce(new.missed, false) = false
    and coalesce(new.late_cancelled, false) = false then
    begin
      perform public.notify_guardian_check_in(new.user_id, new.id);
    exception
      when others then
        raise warning 'Guardian check-in notification failed for user %: %', new.user_id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

update public.profiles p
set referral_code = public.generate_referral_code(),
    updated_at = now()
where p.account_status = 'active'
  and p.referral_code is null;

revoke execute on function public.generate_referral_code() from public, anon, authenticated;
revoke execute on function public.ensure_referral_code(uuid) from public, anon, authenticated;
revoke execute on function public.complete_pending_referral(uuid) from public, anon, authenticated;
revoke execute on function public.notify_member_referral_awarded(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.on_member_activated_referral() from public, anon, authenticated;
revoke execute on function public.apply_referral_code(text) from public, anon, authenticated;
revoke execute on function public.submit_referral(text) from public, anon, authenticated;
revoke execute on function public.link_pending_referrals(uuid) from public, anon, authenticated;
revoke execute on function public.evaluate_referral_progress(uuid) from public, anon, authenticated;
revoke execute on function public.normalize_referral_email(text) from public, anon, authenticated;

grant execute on function public.get_my_referral_code() to authenticated;
grant execute on function public.get_my_referral_status() to authenticated;
grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.get_my_referrals() to authenticated;

update public.referrals
set status = 'pending',
    updated_at = now()
where status in ('activated', 'qualified');
