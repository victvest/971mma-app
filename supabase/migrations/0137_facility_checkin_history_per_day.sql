-- Facility arrival history: allow multiple gate/QR facility entries per member per gym-day.
--
-- Product: members should see every gate arrival that day (not only the first), and the
-- Check-in card "ARRIVED · time" should reflect the latest entry. Streak / training-day
-- counting already uses DISTINCT Dubai calendar days, so multiple rows do not inflate
-- streaks. Redeemable points and guardian push must still fire only on the *first*
-- facility entry of the day (same economy behaviour as migration 0115 intended).
--
-- SALTO response shape is unchanged: still HTTP 200 + { Granted, Message }.

-- 1. Drop the one-facility-row-per-day unique index.
drop index if exists public.idx_check_ins_facility_once_per_day;

-- 2. Keep a non-unique lookup index for "facility entries today" queries.
create index if not exists idx_check_ins_facility_user_gym_day
  on public.check_ins (user_id, gym_day)
  where method in ('gate_scan', 'qr_scan');

comment on index public.idx_check_ins_facility_user_gym_day is
  'Lookup for gate/QR facility arrivals by member + Asia/Dubai gym-day (multiple rows allowed).';

comment on column public.check_ins.gym_day is
  'Asia/Dubai calendar date of checked_in_at. Maintained by trg_check_ins_set_gym_day.';

-- 3. Points: only the first facility (gate_scan / qr_scan) entry of a gym-day awards
--    redeemable check-in points. Later arrivals are history-only.
create or replace function public.award_check_in_points(p_user uuid, p_checkin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_method text;
  v_gym_day date;
begin
  if p_user is null or p_checkin is null then
    return;
  end if;

  select method, gym_day
  into v_method, v_gym_day
  from public.check_ins
  where id = p_checkin;

  if not found then
    return;
  end if;

  if exists (
    select 1
    from public.check_ins
    where id = p_checkin
      and (
        signed_in = false
        or missed = true
        or late_cancelled = true
        -- Mirrored Mindbody history is stats-only; it must not mint redeemable points.
        or method = 'mindbody_visit'
      )
  ) then
    return;
  end if;

  -- Subsequent gate arrivals the same gym-day are arrival history only.
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

  perform public.post_points_transaction(
    p_user,
    10,
    'check_in',
    'check_ins',
    p_checkin,
    'check_in:' || p_checkin::text,
    jsonb_build_object('source', 'attendance')
  );
end;
$$;

revoke execute on function public.award_check_in_points(uuid, uuid) from public, anon, authenticated;

-- 4. Guardian notify: only on the first facility entry of the gym-day (avoid spam).
create or replace function public.on_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
  v_is_repeat_facility boolean := false;
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

  if new.method in ('gate_scan', 'qr_scan') and new.gym_day is not null then
    select exists (
      select 1
      from public.check_ins
      where user_id = new.user_id
        and gym_day = new.gym_day
        and method in ('gate_scan', 'qr_scan')
        and id <> new.id
        and checked_in_at < new.checked_in_at
    )
    into v_is_repeat_facility;
  end if;

  if coalesce(new.signed_in, true) = true
    and coalesce(new.missed, false) = false
    and coalesce(new.late_cancelled, false) = false
    and not v_is_repeat_facility then
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
