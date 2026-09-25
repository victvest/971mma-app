-- Migration 0169: owner-focused attendance dashboard read model.
--
-- A "training day" is one distinct member on one Asia/Dubai calendar day.
-- This intentionally deduplicates repeat gate entries and members attending
-- multiple sessions, while class demand remains a separate session-level view.

create index if not exists idx_check_ins_counted_time_user
  on public.check_ins (checked_in_at desc, user_id)
  where signed_in = true
    and missed = false
    and late_cancelled = false;

create or replace function public.admin_owner_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := timezone('Asia/Dubai', now())::date;
  v_today_start timestamptz := v_today::timestamp at time zone 'Asia/Dubai';
  v_tomorrow_start timestamptz := (v_today + 1)::timestamp at time zone 'Asia/Dubai';
  v_window_start timestamptz := (v_today - 29)::timestamp at time zone 'Asia/Dubai';
  v_current_week_start timestamptz := (v_today - 6)::timestamp at time zone 'Asia/Dubai';
  v_previous_week_start timestamptz := (v_today - 13)::timestamp at time zone 'Asia/Dubai';
  v_active_members int := 0;
  v_engaged_active_members int := 0;
  v_active_training_days int := 0;
  v_training_days int := 0;
  v_current_7_days int := 0;
  v_previous_7_days int := 0;
begin
  perform public.require_admin();

  select count(*)::int
  into v_active_members
  from public.profiles p
  where p.role in ('member', 'guest')
    and lower(coalesce(p.membership_status, '')) in ('active', 'current');

  select
    count(distinct ci.user_id)::int,
    count(distinct (ci.user_id, (ci.checked_in_at at time zone 'Asia/Dubai')::date))::int
  into v_engaged_active_members, v_active_training_days
  from public.check_ins ci
  join public.profiles p on p.id = ci.user_id
  where ci.checked_in_at >= v_window_start
    and ci.checked_in_at < v_tomorrow_start
    and ci.signed_in = true
    and ci.missed = false
    and ci.late_cancelled = false
    and p.role in ('member', 'guest')
    and lower(coalesce(p.membership_status, '')) in ('active', 'current');

  select count(distinct (ci.user_id, (ci.checked_in_at at time zone 'Asia/Dubai')::date))::int
  into v_training_days
  from public.check_ins ci
  join public.profiles p on p.id = ci.user_id
  where ci.checked_in_at >= v_window_start
    and ci.checked_in_at < v_tomorrow_start
    and ci.signed_in = true
    and ci.missed = false
    and ci.late_cancelled = false
    and p.role in ('member', 'guest');

  select
    count(distinct (ci.user_id, (ci.checked_in_at at time zone 'Asia/Dubai')::date))
      filter (where ci.checked_in_at >= v_current_week_start)::int,
    count(distinct (ci.user_id, (ci.checked_in_at at time zone 'Asia/Dubai')::date))
      filter (where ci.checked_in_at >= v_previous_week_start and ci.checked_in_at < v_current_week_start)::int
  into v_current_7_days, v_previous_7_days
  from public.check_ins ci
  join public.profiles p on p.id = ci.user_id
  where ci.checked_in_at >= v_previous_week_start
    and ci.checked_in_at < v_tomorrow_start
    and ci.signed_in = true
    and ci.missed = false
    and ci.late_cancelled = false
    and p.role in ('member', 'guest');

  return jsonb_build_object(
    'generatedAt', now(),
    'windowDays', 30,
    'activeMembers', v_active_members,
    'todayTrainingMembers', (
      select count(distinct ci.user_id)::int
      from public.check_ins ci
      join public.profiles p on p.id = ci.user_id
      where ci.checked_in_at >= v_today_start
        and ci.checked_in_at < v_tomorrow_start
        and ci.signed_in = true
        and ci.missed = false
        and ci.late_cancelled = false
        and p.role in ('member', 'guest')
    ),
    'trainingDays', v_training_days,
    'engagedMembers', v_engaged_active_members,
    'engagementRate', case
      when v_active_members = 0 then null
      else round(v_engaged_active_members::numeric * 100 / v_active_members, 1)
    end,
    'averageTrainingDays', case
      when v_engaged_active_members = 0 then null
      else round(v_active_training_days::numeric / v_engaged_active_members, 1)
    end,
    'atRiskMembers', (
      with last_attendance as (
        select ci.user_id, max(ci.checked_in_at) as last_attended_at
        from public.check_ins ci
        where ci.signed_in = true
          and ci.missed = false
          and ci.late_cancelled = false
        group by ci.user_id
      )
      select count(*)::int
      from public.profiles p
      left join last_attendance la on la.user_id = p.id
      where p.role in ('member', 'guest')
        and lower(coalesce(p.membership_status, '')) in ('active', 'current')
        and coalesce(la.last_attended_at, p.member_since, p.created_at) < now() - interval '14 days'
    ),
    'current7TrainingDays', v_current_7_days,
    'previous7TrainingDays', v_previous_7_days,
    'weeklyChangePercent', case
      when v_previous_7_days = 0 then null
      else round((v_current_7_days - v_previous_7_days)::numeric * 100 / v_previous_7_days, 1)
    end,
    'dailyAttendance', (
      with days as (
        select generate_series(v_today - 29, v_today, interval '1 day')::date as day
      ), counted as (
        select
          (ci.checked_in_at at time zone 'Asia/Dubai')::date as day,
          count(distinct ci.user_id)::int as members
        from public.check_ins ci
        join public.profiles p on p.id = ci.user_id
        where ci.checked_in_at >= v_window_start
          and ci.checked_in_at < v_tomorrow_start
          and ci.signed_in = true
          and ci.missed = false
          and ci.late_cancelled = false
          and p.role in ('member', 'guest')
        group by 1
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object('date', d.day, 'members', coalesce(c.members, 0))
          order by d.day
        ),
        '[]'::jsonb
      )
      from days d
      left join counted c on c.day = d.day
    ),
    'weekdayRhythm', (
      with days as (
        select generate_series(v_today - 27, v_today, interval '1 day')::date as day
      ), counted as (
        select
          (ci.checked_in_at at time zone 'Asia/Dubai')::date as day,
          count(distinct ci.user_id)::int as members
        from public.check_ins ci
        join public.profiles p on p.id = ci.user_id
        where ci.checked_in_at >= (v_today - 27)::timestamp at time zone 'Asia/Dubai'
          and ci.checked_in_at < v_tomorrow_start
          and ci.signed_in = true
          and ci.missed = false
          and ci.late_cancelled = false
          and p.role in ('member', 'guest')
        group by 1
      ), daily as (
        select d.day, coalesce(c.members, 0) as members
        from days d
        left join counted c on c.day = d.day
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'day', trim(to_char(date '2024-01-01' + (x.day_index - 1), 'Dy')),
            'dayIndex', x.day_index,
            'averageMembers', x.average_members
          )
          order by x.day_index
        ),
        '[]'::jsonb
      )
      from (
        select
          extract(isodow from day)::int as day_index,
          round(avg(members)::numeric, 1) as average_members
        from daily
        group by extract(isodow from day)
      ) x
    ),
    'timeBands', (
      with banded as (
        select
          case
            when extract(hour from ci.checked_in_at at time zone 'Asia/Dubai') < 12 then 'Morning'
            when extract(hour from ci.checked_in_at at time zone 'Asia/Dubai') < 17 then 'Afternoon'
            else 'Evening'
          end as band,
          case
            when extract(hour from ci.checked_in_at at time zone 'Asia/Dubai') < 12 then 1
            when extract(hour from ci.checked_in_at at time zone 'Asia/Dubai') < 17 then 2
            else 3
          end as band_order,
          ci.user_id,
          (ci.checked_in_at at time zone 'Asia/Dubai')::date as day
        from public.check_ins ci
        join public.profiles p on p.id = ci.user_id
        where ci.checked_in_at >= v_window_start
          and ci.checked_in_at < v_tomorrow_start
          and ci.signed_in = true
          and ci.missed = false
          and ci.late_cancelled = false
          and p.role in ('member', 'guest')
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object('label', b.band, 'trainingDays', b.training_days)
          order by b.band_order
        ),
        '[]'::jsonb
      )
      from (
        select band, band_order, count(distinct (user_id, day))::int as training_days
        from banded
        group by band, band_order
      ) b
    ),
    'topClasses', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'title', ranked.title,
            'discipline', ranked.discipline,
            'attendanceCount', ranked.attendance_count
          )
          order by ranked.attendance_count desc, ranked.title
        ),
        '[]'::jsonb
      )
      from (
        select
          c.title,
          coalesce(d.display_name, c.discipline, 'General') as discipline,
          count(distinct (ci.class_id, ci.user_id))::int as attendance_count
        from public.check_ins ci
        join public.classes c on c.id = ci.class_id
        left join public.disciplines d on d.id = c.discipline_id
        where ci.checked_in_at >= v_window_start
          and ci.checked_in_at < v_tomorrow_start
          and ci.signed_in = true
          and ci.missed = false
          and ci.late_cancelled = false
        group by c.title, coalesce(d.display_name, c.discipline, 'General')
        order by attendance_count desc, c.title
        limit 5
      ) ranked
    ),
    'membersToReengage', (
      with last_attendance as (
        select ci.user_id, max(ci.checked_in_at) as last_attended_at
        from public.check_ins ci
        where ci.signed_in = true
          and ci.missed = false
          and ci.late_cancelled = false
        group by ci.user_id
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'userId', risk.id,
            'name', risk.full_name,
            'membership', risk.membership_name,
            'lastVisitAt', risk.last_attended_at,
            'daysAway', risk.days_away
          )
          order by risk.days_away desc, risk.full_name
        ),
        '[]'::jsonb
      )
      from (
        select
          p.id,
          coalesce(nullif(trim(p.full_name), ''), 'Member') as full_name,
          coalesce(nullif(trim(p.membership_name), ''), 'Active membership') as membership_name,
          la.last_attended_at,
          greatest(
            14,
            floor(extract(epoch from (now() - coalesce(la.last_attended_at, p.member_since, p.created_at))) / 86400)::int
          ) as days_away
        from public.profiles p
        left join last_attendance la on la.user_id = p.id
        where p.role in ('member', 'guest')
          and lower(coalesce(p.membership_status, '')) in ('active', 'current')
          and coalesce(la.last_attended_at, p.member_since, p.created_at) < now() - interval '14 days'
        order by days_away desc, full_name
        limit 5
      ) risk
    )
  );
end;
$$;

revoke all on function public.admin_owner_dashboard() from public, anon;
grant execute on function public.admin_owner_dashboard() to authenticated;
