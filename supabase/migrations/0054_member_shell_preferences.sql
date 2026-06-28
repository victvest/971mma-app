-- Phase 5: member shell eligibility, notification preferences, and staff-managed guardian links.

drop policy if exists "users select own member_disciplines" on public.member_disciplines;
drop policy if exists "member_disciplines select readable member" on public.member_disciplines;
create policy "member_disciplines select readable member"
  on public.member_disciplines
  for select to authenticated
  using (public.can_read_member_data(user_id));

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  announcements boolean not null default true,
  class_reminders boolean not null default true,
  milestones boolean not null default true,
  rewards boolean not null default true,
  guardian_alerts boolean not null default true,
  community boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences select own" on public.notification_preferences;
create policy "notification_preferences select own"
  on public.notification_preferences
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notification_preferences insert own" on public.notification_preferences;
create policy "notification_preferences insert own"
  on public.notification_preferences
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "notification_preferences update own" on public.notification_preferences;
create policy "notification_preferences update own"
  on public.notification_preferences
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.notification_preferences (user_id)
select p.id
from public.profiles p
where not exists (
  select 1
  from public.notification_preferences np
  where np.user_id = p.id
)
on conflict (user_id) do nothing;

create or replace function public.get_notification_preferences()
returns public.notification_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.notification_preferences;
begin
  if auth.uid() is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  insert into public.notification_preferences (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select *
    into v_row
  from public.notification_preferences
  where user_id = auth.uid();

  return v_row;
end;
$$;

create or replace function public.update_notification_preferences(
  p_announcements boolean default null,
  p_class_reminders boolean default null,
  p_milestones boolean default null,
  p_rewards boolean default null,
  p_guardian_alerts boolean default null,
  p_community boolean default null
)
returns public.notification_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.notification_preferences;
begin
  if auth.uid() is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  insert into public.notification_preferences (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.notification_preferences
  set announcements = coalesce(p_announcements, announcements),
      class_reminders = coalesce(p_class_reminders, class_reminders),
      milestones = coalesce(p_milestones, milestones),
      rewards = coalesce(p_rewards, rewards),
      guardian_alerts = coalesce(p_guardian_alerts, guardian_alerts),
      community = coalesce(p_community, community),
      updated_at = now()
  where user_id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.notification_enabled(p_user uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type ilike '%announcement%' then coalesce(np.announcements, true)
    when p_type ilike '%class%' or p_type ilike '%reminder%' then coalesce(np.class_reminders, true)
    when p_type ilike '%milestone%' or p_type ilike '%promotion%' or p_type ilike '%belt%' then coalesce(np.milestones, true)
    when p_type ilike '%reward%' or p_type ilike '%redemption%' or p_type ilike '%point%' then coalesce(np.rewards, true)
    when p_type ilike '%guardian%' or p_type ilike '%child%' then coalesce(np.guardian_alerts, true)
    when p_type ilike '%community%' then coalesce(np.community, true)
    else true
  end
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id
  where p.id = p_user
$$;

revoke execute on function public.get_notification_preferences() from public, anon;
revoke execute on function public.update_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke execute on function public.notification_enabled(uuid, text) from public, anon;
grant execute on function public.get_notification_preferences() to authenticated;
grant execute on function public.update_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.notification_enabled(uuid, text) to authenticated;

create or replace function public.create_announcement(
  p_channel text,
  p_title text,
  p_body text
)
returns public.announcements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel text := nullif(trim(p_channel), '');
  v_title text := nullif(trim(p_title), '');
  v_body text := nullif(trim(p_body), '');
  v_row public.announcements%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if v_title is null or v_body is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  insert into public.announcements (author_id, channel, title, body)
  values (auth.uid(), coalesce(v_channel, 'general'), v_title, v_body)
  returning * into v_row;

  insert into public.notifications (user_id, type, payload)
  select
    p.id,
    'announcement',
    jsonb_build_object(
      'announcementId', v_row.id,
      'channel', v_row.channel,
      'title', v_row.title,
      'body', v_row.body
    )
  from public.profiles p
  where coalesce(public.notification_enabled(p.id, 'announcement'), true);

  return v_row;
end;
$$;

create or replace function public.insert_class_notifications_once(
  p_user_ids uuid[],
  p_type text,
  p_class_id uuid,
  p_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_inserted integer := 0;
  v_row_count integer;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb)
    || jsonb_build_object('classId', p_class_id);
begin
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    return 0;
  end if;

  if p_type not in ('class_reminder', 'class_cancelled') or p_class_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  foreach v_user_id in array p_user_ids loop
    if v_user_id is null or not coalesce(public.notification_enabled(v_user_id, p_type), true) then
      continue;
    end if;

    begin
      insert into public.notifications (user_id, type, payload)
      select v_user_id, p_type, v_payload
      where not exists (
        select 1
        from public.notifications n
        where n.user_id = v_user_id
          and n.type = p_type
          and n.payload->>'classId' = p_class_id::text
      );

      get diagnostics v_row_count = row_count;
      v_inserted := v_inserted + v_row_count;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  return v_inserted;
end;
$$;

create or replace function public.roll_call_notify_member(
  p_user_id uuid,
  p_class_id uuid,
  p_status text,
  p_marked_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notify_present boolean;
  v_notify_absent boolean;
  v_class_title text;
  v_copy jsonb;
begin
  if p_user_id is null or p_class_id is null or p_status is null then
    return;
  end if;

  if not coalesce(public.notification_enabled(p_user_id, 'class_attendance'), true) then
    return;
  end if;

  select notify_member_present, notify_member_absent
    into v_notify_present, v_notify_absent
  from public.roll_call_settings
  where id = 1;

  if p_status in ('present', 'late') and not coalesce(v_notify_present, true) then
    return;
  end if;

  if p_status = 'absent' and not coalesce(v_notify_absent, false) then
    return;
  end if;

  select c.title into v_class_title
  from public.classes c
  where c.id = p_class_id;

  if not found then
    return;
  end if;

  v_copy := public.roll_call_member_notification_copy(p_status, v_class_title);
  if v_copy is null then
    return;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    p_user_id,
    'class_attendance',
    jsonb_build_object(
      'title', v_copy->>'title',
      'body', v_copy->>'body',
      'classId', p_class_id,
      'status', p_status,
      'markedAt', p_marked_at
    )
  );
end;
$$;

revoke execute on function public.create_announcement(text, text, text) from public, anon;
revoke execute on function public.insert_class_notifications_once(uuid[], text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.roll_call_notify_member(uuid, uuid, text, timestamptz) from public, anon;
grant execute on function public.create_announcement(text, text, text) to authenticated;
grant execute on function public.insert_class_notifications_once(uuid[], text, uuid, jsonb) to service_role;
grant execute on function public.roll_call_notify_member(uuid, uuid, text, timestamptz) to authenticated;

drop policy if exists "guardian_links insert own pending" on public.guardian_links;

drop function if exists public.request_child_link(text, date, text, text, text, text);
drop function if exists public.request_child_link(text, date, text, text, text, text, text);
drop function if exists public.request_child_link(text, date, text, text, text, text, text, text);

create or replace function public.request_child_link(
  p_child_name text,
  p_date_of_birth date default null,
  p_email text default null,
  p_phone text default null,
  p_mindbody_client_id text default null,
  p_notes text default null,
  p_account_mode text default 'managed',
  p_child_avatar_url text default null
)
returns public.guardian_links
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception using
    message = 'STAFF_MANAGED_ONLY',
    detail = 'Family trainee links are created by academy staff in the admin web app.',
    errcode = 'P0001';
end;
$$;

revoke execute on function public.request_child_link(text, date, text, text, text, text, text, text) from public, anon;
grant execute on function public.request_child_link(text, date, text, text, text, text, text, text) to authenticated;

create or replace function public.get_member_home_dashboard(p_user uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_points public.points_accounts%rowtype;
  v_score public.discipline_scores%rowtype;
  v_progress public.member_belt_progress%rowtype;
  v_rank public.belt_ranks%rowtype;
  v_rank_discipline public.disciplines%rowtype;
  v_has_rank boolean := false;
  v_training_days numeric := 0;
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_classes jsonb := '[]'::jsonb;
  v_coaches jsonb := '[]'::jsonb;
  v_week jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception using message = 'Not authenticated', errcode = 'P0001';
  end if;

  if v_user is null or not public.can_read_member_data(v_user) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select d.*
    into v_rank_discipline
  from public.member_disciplines md
  join public.disciplines d on d.id = md.discipline_id
  where md.user_id = v_user
    and md.active = true
    and d.active = true
    and d.has_rank_progression = true
  order by d.sort_order asc
  limit 1;

  v_has_rank := v_rank_discipline.id is not null;

  select *
    into v_points
  from public.points_accounts
  where user_id = v_user;

  select *
    into v_score
  from public.discipline_scores
  where user_id = v_user;

  v_training_days := public.count_training_days(v_user);

  if v_has_rank then
    select *
      into v_progress
    from public.member_belt_progress
    where user_id = v_user
      and discipline = v_rank_discipline.slug;

    if v_progress.rank_id is not null then
      select *
        into v_rank
      from public.belt_ranks
      where id = v_progress.rank_id;
    end if;

    if v_rank.id is null then
      select *
        into v_rank
      from public.belt_ranks
      where discipline = v_rank_discipline.slug
      order by "order" asc
      limit 1;
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'discipline', coalesce(d.display_name, c.discipline),
        'disciplineId', c.discipline_id,
        'description', c.description,
        'coachName', coalesce(co.name, c.coach_name, 'Coach'),
        'coachId', c.coach_id,
        'startsAt', c.starts_at,
        'durationMinutes', c.duration_minutes,
        'capacity', c.capacity,
        'level', coalesce(c.level, 'All Levels'),
        'imageUrl', c.image_url,
        'bookedCount', c.booked_count,
        'isAvailable', c.is_available,
        'isWaitlistAvailable', c.is_waitlist_available,
        'isCancelled', c.is_cancelled,
        'mindbodyClassId', c.mindbody_class_id,
        'staffMindbodyId', c.staff_mindbody_id
      )
      order by c.starts_at asc
    ),
    '[]'::jsonb
  )
    into v_classes
  from (
    select *
    from public.classes
    where mindbody_class_id is not null
      and is_cancelled = false
      and starts_at + (duration_minutes * interval '1 minute') > now()
    order by starts_at asc
    limit 3
  ) c
  left join public.disciplines d on d.id = c.discipline_id
  left join public.coaches co on co.id = c.coach_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'mindbodyStaffId', c.mindbody_staff_id,
        'name', c.name,
        'specialty', c.specialty,
        'rank', c.rank,
        'rating', c.rating,
        'bio', c.bio,
        'photoUrl', c.photo_url,
        'isHeadCoach', c.is_head_coach
      )
      order by c.is_head_coach desc, c.sort_order asc, c.name asc
    ),
    '[]'::jsonb
  )
    into v_coaches
  from (
    select *
    from public.coaches
    where slug is not null
      and coalesce(active, true) = true
    order by is_head_coach desc, sort_order asc, name asc
    limit 5
  ) c;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(day_value, 'YYYY-MM-DD'),
        'trained', exists (
          select 1
          from public.check_ins ci
          where ci.user_id = v_user
            and ci.signed_in = true
            and ci.missed = false
            and ci.late_cancelled = false
            and (ci.checked_in_at at time zone 'Asia/Dubai')::date = day_value::date
        )
      )
      order by day_value asc
    ),
    '[]'::jsonb
  )
    into v_week
  from generate_series(v_today - 6, v_today, interval '1 day') as days(day_value);

  return jsonb_build_object(
    'upcomingClasses', v_classes,
    'coachPreview', v_coaches,
    'points', jsonb_build_object(
      'userId', v_user,
      'balance', coalesce(v_points.balance, 0),
      'tier', coalesce(v_points.tier, 'bronze'),
      'lifetimePoints', coalesce(v_points.lifetime_points, 0),
      'updatedAt', v_points.updated_at
    ),
    'disciplineScore', jsonb_build_object(
      'score', coalesce(v_score.score, 0),
      'currentStreak', coalesce((v_score.components->>'currentStreak')::numeric, 0),
      'bestStreak', coalesce((v_score.components->>'bestStreak')::numeric, 0),
      'trainingDays', v_training_days,
      'trainingDays30d', coalesce((v_score.components->>'trainingDays30d')::numeric, 0),
      'monthlyGoalPct', coalesce((v_score.components->>'monthlyGoalPct')::numeric, 0),
      'computedAt', v_score.computed_at,
      'isPlaceholderWeights', coalesce((v_score.components->>'weightsPlaceholder')::boolean, false)
    ),
    'weekActivity', v_week,
    'rankEligibility', jsonb_build_object(
      'eligible', v_has_rank,
      'disciplineSlug', v_rank_discipline.slug,
      'disciplineName', v_rank_discipline.display_name
    ),
    'beltProgress', case
      when v_has_rank then jsonb_build_object(
        'userId', v_user,
        'discipline', v_rank_discipline.slug,
        'rankId', coalesce(v_progress.rank_id, v_rank.id),
        'rankName', coalesce(v_rank.name, 'White'),
        'stripe', coalesce(v_progress.stripe, 0),
        'maxStripes', coalesce(v_rank.stripes, 4),
        'percent', coalesce(v_progress.percent, 0),
        'trainingDays', v_training_days,
        'updatedAt', coalesce(v_progress.updated_at, now())
      )
      else null
    end
  );
end;
$$;

revoke all on function public.get_member_home_dashboard(uuid) from public, anon;
grant execute on function public.get_member_home_dashboard(uuid) to authenticated;
