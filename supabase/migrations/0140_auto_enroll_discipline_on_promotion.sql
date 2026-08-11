-- Migration: 0140_auto_enroll_discipline_on_promotion.sql
-- Auto-enroll member in the discipline when awarding a promotion if they are not already enrolled.

create or replace function public.award_promotion(
  p_user uuid,
  p_discipline text default 'bjj',
  p_to_stripe int default null,
  p_to_rank uuid default null
)
returns public.rank_promotions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline_id uuid;
  v_progress public.member_rank_progress%rowtype;
  v_from_rank_level_id uuid;
  v_from_stripe int;
  v_to_rank_level_id uuid;
  v_to_stripe int;
  v_rank_stripe_count int;
  v_promotion public.rank_promotions%rowtype;
  v_rank_name text;
  v_has_discipline boolean;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select id into v_discipline_id from public.disciplines where slug = p_discipline;
  if v_discipline_id is null then
    raise exception using errcode = 'P0001', message = 'Discipline not found.';
  end if;

  if p_discipline not in ('bjj', 'wrestling') then
    raise exception using errcode = 'P0001', message = 'Rank progression only exists for BJJ and Wrestling.';
  end if;

  -- Ensure member has an active discipline record (auto-enroll if not already active)
  select exists (
    select 1 from public.member_disciplines
    where user_id = p_user
      and discipline_id = v_discipline_id
      and active = true
  ) into v_has_discipline;

  if not v_has_discipline then
    update public.member_disciplines
    set active = true, updated_at = now()
    where user_id = p_user
      and discipline_id = v_discipline_id
      and source = 'admin_override';

    if not found then
      insert into public.member_disciplines (user_id, discipline_id, source, active, starts_on)
      values (p_user, v_discipline_id, 'admin_override', true, now()::date);
    end if;
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    if not exists (
      select 1 from public.coach_disciplines cd
      join public.coaches c on c.id = cd.coach_id
      where c.user_id = auth.uid()
        and cd.discipline_id = v_discipline_id
    ) then
      raise exception using errcode = 'P0001', message = 'Coach is not assigned to this discipline.';
    end if;
  end if;

  perform public.recompute_belt_progress(p_user, p_discipline);

  select *
    into v_progress
  from public.member_rank_progress
  where user_id = p_user
    and discipline_id = v_discipline_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Member rank progress not found.';
  end if;

  v_from_rank_level_id := v_progress.rank_level_id;
  v_from_stripe := v_progress.stripe;
  v_to_rank_level_id := coalesce(p_to_rank, v_progress.rank_level_id);
  v_to_stripe := coalesce(p_to_stripe, v_progress.stripe + 1);

  select stripe_count, name
    into v_rank_stripe_count, v_rank_name
  from public.rank_levels
  where id = v_to_rank_level_id;

  if v_to_rank_level_id = v_progress.rank_level_id and v_to_stripe > v_rank_stripe_count then
    raise exception using errcode = 'P0001', message = 'Stripe exceeds rank maximum.';
  end if;

  if v_to_rank_level_id = v_progress.rank_level_id and v_to_stripe <= v_progress.stripe then
    raise exception using errcode = 'P0001', message = 'Promotion must advance stripe or rank.';
  end if;

  insert into public.rank_promotions (
    user_id,
    discipline_id,
    from_rank_level_id,
    to_rank_level_id,
    from_stripe,
    to_stripe,
    awarded_by,
    awarded_at
  )
  values (
    p_user,
    v_discipline_id,
    v_from_rank_level_id,
    v_to_rank_level_id,
    v_from_stripe,
    v_to_stripe,
    auth.uid(),
    now()
  )
  returning * into v_promotion;

  update public.member_rank_progress
  set rank_level_id = v_to_rank_level_id,
      stripe = v_to_stripe,
      updated_at = now()
  where user_id = p_user
    and discipline_id = v_discipline_id;

  if p_discipline = 'bjj' then
    update public.profiles
    set belt_rank = v_rank_name,
        belt_stripes = v_to_stripe,
        updated_at = now()
    where id = p_user;
  end if;

  perform public.post_points_transaction(
    p_user,
    50,
    'promotion',
    'rank_promotions',
    v_promotion.id,
    'promotion:' || v_promotion.id::text,
    jsonb_build_object('discipline', p_discipline)
  );

  perform public.evaluate_milestones(p_user);
  perform public.recompute_belt_progress(p_user, p_discipline);

  begin
    perform public.notify_member_promotion(p_user, v_promotion.id);
  exception
    when others then
      raise warning 'Member promotion notification failed for user %: %', p_user, sqlerrm;
  end;

  begin
    perform public.notify_guardian_promotion(p_user, v_promotion.id);
  exception
    when others then
      raise warning 'Guardian promotion notification failed for user %: %', p_user, sqlerrm;
  end;

  return v_promotion;
end;
$$;
