-- App-aware attendance segments for the admin dashboard, member directory, and broadcasts.
-- Historical Mindbody visits remain available in member detail, but re-engagement
-- starts at the member's app account creation date so imported legacy history does
-- not turn into misleading 300+ day app inactivity.

create or replace function public.admin_app_reengagement_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return (
    with app_members as (
      select
        p.id,
        coalesce(nullif(trim(p.full_name), ''), 'Member') as full_name,
        coalesce(nullif(trim(p.membership_name), ''), 'Active membership') as membership_name,
        p.created_at as app_joined_at,
        max(ci.checked_in_at) filter (
          where ci.signed_in = true
            and ci.missed = false
            and ci.late_cancelled = false
        ) as last_visit_at,
        max(ci.checked_in_at) filter (
          where ci.checked_in_at >= p.created_at
            and ci.signed_in = true
            and ci.missed = false
            and ci.late_cancelled = false
        ) as last_app_visit_at
      from public.profiles p
      left join public.check_ins ci on ci.user_id = p.id
      where p.role in ('member', 'guest')
        and p.account_status = 'active'
        and lower(coalesce(p.membership_status, '')) in ('active', 'current')
      group by p.id, p.full_name, p.membership_name, p.created_at
    ), eligible as (
      select
        id,
        full_name,
        membership_name,
        last_app_visit_at,
        greatest(
          14,
          floor(extract(epoch from (now() - coalesce(last_app_visit_at, app_joined_at))) / 86400)::int
        ) as days_away
      from app_members
      where app_joined_at <= now() - interval '14 days'
        and coalesce(last_app_visit_at, app_joined_at) < now() - interval '14 days'
    )
    select jsonb_build_object(
      'atRiskMembers', (select count(*)::int from eligible),
      'membersToReengage', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'userId', e.id,
              'name', e.full_name,
              'membership', e.membership_name,
              'lastVisitAt', e.last_app_visit_at,
              'daysAway', e.days_away
            )
            order by e.days_away desc, e.full_name
          )
          from (select * from eligible order by days_away desc, full_name limit 5) e
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

revoke all on function public.admin_app_reengagement_snapshot() from public, anon;
grant execute on function public.admin_app_reengagement_snapshot() to authenticated;

create or replace function public.admin_owner_dashboard_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return public.admin_owner_dashboard() || public.admin_app_reengagement_snapshot();
end;
$$;

revoke all on function public.admin_owner_dashboard_v2() from public, anon;
grant execute on function public.admin_owner_dashboard_v2() to authenticated;

create or replace function public.admin_member_attendance_summary(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_app_joined_at timestamptz;
begin
  perform public.require_admin();

  select p.created_at into v_app_joined_at
  from public.profiles p
  where p.id = p_user_id;

  return jsonb_build_object(
    'lastVisitAt', (
      select max(ci.checked_in_at)
      from public.check_ins ci
      where ci.user_id = p_user_id
        and ci.signed_in = true
        and ci.missed = false
        and ci.late_cancelled = false
    ),
    'lastAppVisitAt', (
      select max(ci.checked_in_at)
      from public.check_ins ci
      where ci.user_id = p_user_id
        and ci.checked_in_at >= v_app_joined_at
        and ci.signed_in = true
        and ci.missed = false
        and ci.late_cancelled = false
    ),
    'appJoinedAt', v_app_joined_at
  );
end;
$$;

revoke all on function public.admin_member_attendance_summary(uuid) from public, anon;
grant execute on function public.admin_member_attendance_summary(uuid) to authenticated;

create or replace function public.admin_list_app_absent_members(
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  user_id uuid,
  full_name text,
  role text,
  account_status text,
  membership_status text,
  phone text,
  avatar_url text,
  created_at timestamptz,
  email text,
  mindbody_client_id text,
  points_balance int,
  last_visit_at timestamptz,
  days_away int,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(p_query), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.require_admin();

  return query
  with eligible as (
    select
      p.id as user_id,
      p.full_name,
      p.role,
      p.account_status,
      p.membership_status,
      p.phone,
      p.avatar_url,
      p.created_at,
      u.email::text,
      ml.mindbody_client_id,
      coalesce(pa.balance, 0)::int as points_balance,
      max(ci.checked_in_at) filter (
        where ci.checked_in_at >= p.created_at
          and ci.signed_in = true
          and ci.missed = false
          and ci.late_cancelled = false
      ) as last_visit_at,
      floor(extract(epoch from (now() - coalesce(
        max(ci.checked_in_at) filter (
          where ci.checked_in_at >= p.created_at
            and ci.signed_in = true
            and ci.missed = false
            and ci.late_cancelled = false
        ),
        p.created_at
      ))) / 86400)::int as days_away
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.mindbody_links ml on ml.user_id = p.id
    left join public.points_accounts pa on pa.user_id = p.id
    left join public.check_ins ci on ci.user_id = p.id
    where p.role in ('member', 'guest')
      and p.account_status = 'active'
      and lower(coalesce(p.membership_status, '')) in ('active', 'current')
      and p.created_at <= now() - interval '14 days'
      and u.email::text not ilike '%@privaterelay.appleid.com'
      and (
        v_query is null
        or p.id::text = v_query
        or p.full_name ilike '%' || v_query || '%'
        or u.email::text ilike '%' || v_query || '%'
        or p.phone ilike '%' || v_query || '%'
        or ml.mindbody_client_id ilike '%' || v_query || '%'
      )
    group by p.id, p.full_name, p.role, p.account_status, p.membership_status,
      p.phone, p.avatar_url, p.created_at, u.email, ml.mindbody_client_id, pa.balance
    having coalesce(
      max(ci.checked_in_at) filter (
        where ci.checked_in_at >= p.created_at
          and ci.signed_in = true
          and ci.missed = false
          and ci.late_cancelled = false
      ),
      p.created_at
    ) < now() - interval '14 days'
  ), counted as (
    select eligible.*, count(*) over () as total_count
    from eligible
  )
  select
    counted.user_id,
    counted.full_name,
    counted.role,
    counted.account_status,
    counted.membership_status,
    counted.phone,
    counted.avatar_url,
    counted.created_at,
    counted.email,
    counted.mindbody_client_id,
    counted.points_balance,
    counted.last_visit_at,
    counted.days_away,
    counted.total_count
  from counted
  order by counted.days_away desc, counted.full_name, counted.user_id
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_app_absent_members(text, int, int) from public, anon;
grant execute on function public.admin_list_app_absent_members(text, int, int) to authenticated;

create or replace function public.admin_send_broadcast(
  p_title text,
  p_body text,
  p_audience text default 'members',
  p_channel text default 'broadcast'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := nullif(trim(p_title), '');
  v_body text := nullif(trim(p_body), '');
  v_audience text := lower(coalesce(nullif(trim(p_audience), ''), 'members'));
  v_channel text := nullif(trim(p_channel), '');
  v_row public.announcements%rowtype;
  v_recipients integer := 0;
begin
  perform public.require_admin();

  if v_title is null or v_body is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_audience not in ('all', 'members', 'coaches', 'active_members', 'app_absent_members') then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  insert into public.announcements (author_id, channel, title, body)
  values (auth.uid(), coalesce(v_channel, 'broadcast'), v_title, v_body)
  returning * into v_row;

  insert into public.notifications (user_id, type, payload)
  select
    p.id,
    'announcement',
    jsonb_build_object(
      'announcementId', v_row.id,
      'channel', v_row.channel,
      'title', v_row.title,
      'body', v_row.body,
      'audience', v_audience
    )
  from public.profiles p
  where coalesce(public.notification_enabled(p.id, 'announcement'), true)
    and (
      v_audience = 'all'
      or (v_audience = 'members' and p.role in ('member', 'guest'))
      or (v_audience = 'coaches' and p.role = 'coach')
      or (
        v_audience = 'active_members'
        and p.account_status = 'active'
        and p.role in ('member', 'guest')
      )
      or (
        v_audience = 'app_absent_members'
        and p.account_status = 'active'
        and p.role in ('member', 'guest')
        and lower(coalesce(p.membership_status, '')) in ('active', 'current')
        and p.created_at <= now() - interval '14 days'
        and coalesce(
          (
            select max(ci.checked_in_at)
            from public.check_ins ci
            where ci.user_id = p.id
              and ci.checked_in_at >= p.created_at
              and ci.signed_in = true
              and ci.missed = false
              and ci.late_cancelled = false
          ),
          p.created_at
        ) < now() - interval '14 days'
      )
    );

  get diagnostics v_recipients = row_count;

  perform public.write_admin_audit(
    'send_broadcast',
    'announcements',
    v_row.id::text,
    jsonb_build_object(
      'audience', v_audience,
      'channel', v_row.channel,
      'recipientCount', v_recipients
    )
  );

  return jsonb_build_object(
    'id', v_row.id,
    'title', v_row.title,
    'body', v_row.body,
    'channel', v_row.channel,
    'audience', v_audience,
    'recipientCount', v_recipients,
    'createdAt', v_row.created_at
  );
end;
$$;

revoke execute on function public.admin_send_broadcast(text, text, text, text) from public, anon;
grant execute on function public.admin_send_broadcast(text, text, text, text) to authenticated;
