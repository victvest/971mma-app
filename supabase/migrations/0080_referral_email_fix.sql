-- Fix referral email resolution (profiles has no email; use auth.users)
-- Isolate referral progress so a failure cannot roll back milestone/streak work.

create or replace function public.link_pending_referrals(p_user uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_updated int := 0;
begin
  if p_user is null then
    return 0;
  end if;

  select lower(trim(u.email::text))
    into v_email
  from auth.users u
  where u.id = p_user;

  if v_email is null or v_email = '' then
    return 0;
  end if;

  update public.referrals r
  set referred_user_id = p_user,
      status = 'activated',
      updated_at = now()
  where r.status = 'pending'
    and r.referred_user_id is null
    and r.referrer_user_id <> p_user
    and public.normalize_referral_email(r.referred_email) = v_email;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.submit_referral(p_referred_email text)
returns public.referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid := auth.uid();
  v_email text;
  v_self_email text;
  v_pending_count int;
  v_existing_user uuid;
  v_row public.referrals%rowtype;
begin
  if v_referrer is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  v_email := public.normalize_referral_email(p_referred_email);
  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception using message = 'INVALID_EMAIL', errcode = 'P0001';
  end if;

  select lower(trim(u.email::text))
    into v_self_email
  from auth.users u
  where u.id = v_referrer;

  if v_self_email is not null and v_self_email = v_email then
    raise exception using message = 'SELF_REFERRAL', errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.referrals r
    where r.referrer_user_id = v_referrer
      and r.status in ('pending', 'activated', 'qualified', 'awarded')
      and (
        public.normalize_referral_email(r.referred_email) = v_email
        or r.referred_user_id = (
          select u.id
          from auth.users u
          where lower(trim(u.email::text)) = v_email
          limit 1
        )
      )
  ) then
    raise exception using message = 'REFERRAL_EXISTS', errcode = 'P0001';
  end if;

  select count(*)::int
    into v_pending_count
  from public.referrals
  where referrer_user_id = v_referrer
    and status = 'pending';

  if v_pending_count >= 10 then
    raise exception using message = 'REFERRAL_LIMIT', errcode = 'P0001';
  end if;

  insert into public.referrals (
    referrer_user_id,
    referred_email,
    status,
    metadata
  )
  values (
    v_referrer,
    v_email,
    'pending',
    jsonb_build_object('submittedAt', now())
  )
  returning * into v_row;

  select u.id
    into v_existing_user
  from auth.users u
  where lower(trim(u.email::text)) = v_email
  limit 1;

  if v_existing_user is not null then
    perform public.link_pending_referrals(v_existing_user);
    select *
      into v_row
    from public.referrals
    where id = v_row.id;
  end if;

  return v_row;
end;
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

    begin
      perform public.evaluate_referral_progress(new.user_id);
    exception
      when others then
        raise warning 'Referral progress failed for user %: %', new.user_id, sqlerrm;
    end;

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
