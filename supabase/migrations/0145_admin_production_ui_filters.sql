-- Production admin UI support:
-- - searchable/sortable activation queue that hides Apple private relay emails
-- - searchable/sortable feed moderation with author IDs for member navigation
-- - role promotion to coach creates/links a manageable coach profile

drop function if exists public.admin_list_activation_requests(text, int, int);

create or replace function public.admin_list_activation_requests(
  p_status text default null,
  p_limit int default 20,
  p_offset int default 0,
  p_query text default null,
  p_order text default 'newest'
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
  v_status text := nullif(trim(p_status), '');
  v_query text := nullif(trim(p_query), '');
  v_order text := lower(coalesce(nullif(trim(p_order), ''), 'newest'));
begin
  perform public.require_admin();

  if v_order not in ('newest', 'oldest', 'linked_first') then
    v_order := 'newest';
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
    coalesce(nullif(trim(p.phone), ''), nullif(trim(u.phone), '')) as phone,
    p.account_status,
    ml.mindbody_client_id
  from public.activation_requests ar
  join public.profiles p on p.id = ar.user_id
  join auth.users u on u.id = ar.user_id
  left join public.mindbody_links ml on ml.user_id = ar.user_id
  where (v_status is null or ar.status = v_status)
    and u.email::text not ilike '%@privaterelay.appleid.com'
    and (
      v_query is null
      or p.full_name ilike '%' || v_query || '%'
      or u.email::text ilike '%' || v_query || '%'
      or p.phone ilike '%' || v_query || '%'
      or u.phone ilike '%' || v_query || '%'
      or ml.mindbody_client_id ilike '%' || v_query || '%'
      or ar.user_id::text = v_query
    )
  order by
    case when v_status is null and ar.status = 'pending' then 0 else 1 end,
    case
      when v_order = 'linked_first' and ml.mindbody_client_id is not null then 0
      when v_order = 'linked_first' then 1
      else 0
    end,
    case when v_order = 'oldest' then ar.requested_at end asc,
    case when v_order in ('newest', 'linked_first') then ar.requested_at end desc,
    ar.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_activation_requests(text, int, int, text, text) from public;
grant execute on function public.admin_list_activation_requests(text, int, int, text, text) to authenticated;

create or replace function public.admin_count_activation_requests(
  p_status text default null,
  p_query text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := nullif(trim(p_status), '');
  v_query text := nullif(trim(p_query), '');
  v_count int;
begin
  perform public.require_admin();

  select count(*)::int
  into v_count
  from public.activation_requests ar
  join public.profiles p on p.id = ar.user_id
  join auth.users u on u.id = ar.user_id
  left join public.mindbody_links ml on ml.user_id = ar.user_id
  where (v_status is null or ar.status = v_status)
    and u.email::text not ilike '%@privaterelay.appleid.com'
    and (
      v_query is null
      or p.full_name ilike '%' || v_query || '%'
      or u.email::text ilike '%' || v_query || '%'
      or p.phone ilike '%' || v_query || '%'
      or u.phone ilike '%' || v_query || '%'
      or ml.mindbody_client_id ilike '%' || v_query || '%'
      or ar.user_id::text = v_query
    );

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.admin_count_activation_requests(text, text) from public;
grant execute on function public.admin_count_activation_requests(text, text) to authenticated;

create or replace function public.admin_mindbody_resource_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.require_admin();

  select jsonb_build_object(
    'linkedMembers', (
      select count(*)::int
      from public.mindbody_links
    ),
    'mirroredMemberships', (
      select count(*)::int
      from public.member_memberships
    ),
    'activePrograms', (
      select count(*)::int
      from public.programs
      where active = true
    ),
    'totalPrograms', (
      select count(*)::int
      from public.programs
    ),
    'classesWithMindbodyProgram', (
      select count(*)::int
      from public.classes
      where program_id is not null
    ),
    'profilesSyncedFromMindbody', (
      select count(*)::int
      from public.profiles
      where mindbody_synced_at is not null
    ),
    'gateAccessAttempts24h', (
      select count(*)::int
      from public.gate_access_attempts
      where requested_at >= now() - interval '24 hours'
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_mindbody_resource_summary() from public;
grant execute on function public.admin_mindbody_resource_summary() to authenticated;

drop function if exists public.admin_list_feed_moderation(text, int, int);

create or replace function public.admin_list_feed_moderation(
  p_status text default null,
  p_limit int default 25,
  p_offset int default 0,
  p_query text default null,
  p_order text default 'newest'
)
returns table (
  target_type text,
  target_id uuid,
  post_id uuid,
  discipline_name text,
  author_name text,
  author_id uuid,
  preview text,
  status text,
  like_count int,
  comment_count int,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := nullif(lower(trim(coalesce(p_status, ''))), '');
  v_query text := nullif(trim(p_query), '');
  v_order text := lower(coalesce(nullif(trim(p_order), ''), 'newest'));
begin
  perform public.require_admin();

  if v_status is not null and v_status not in ('published', 'hidden', 'deleted') then
    v_status := null;
  end if;

  if v_order not in ('newest', 'oldest', 'engagement') then
    v_order := 'newest';
  end if;

  return query
  select
    rows.target_type,
    rows.target_id,
    rows.post_id,
    rows.discipline_name,
    rows.author_name,
    rows.author_id,
    rows.preview,
    rows.status,
    rows.like_count,
    rows.comment_count,
    rows.created_at
  from (
    select
      'post'::text as target_type,
      fp.id as target_id,
      fp.id as post_id,
      d.display_name as discipline_name,
      coalesce(nullif(trim(p.full_name), ''), 'Member') as author_name,
      fp.author_id as author_id,
      left(fp.body, 180) as preview,
      fp.status as status,
      fp.like_count as like_count,
      fp.comment_count as comment_count,
      fp.published_at as created_at,
      fp.like_count + fp.comment_count as engagement_score
    from public.feed_posts fp
    join public.profiles p on p.id = fp.author_id
    join public.disciplines d on d.id = fp.discipline_id
    where fp.status in ('published', 'hidden', 'deleted')
      and (v_status is null or fp.status = v_status)
      and (
        v_query is null
        or fp.body ilike '%' || v_query || '%'
        or p.full_name ilike '%' || v_query || '%'
        or d.display_name ilike '%' || v_query || '%'
        or fp.id::text = v_query
        or fp.author_id::text = v_query
      )

    union all

    select
      'comment'::text as target_type,
      fc.id as target_id,
      fc.post_id as post_id,
      d.display_name as discipline_name,
      coalesce(nullif(trim(p.full_name), ''), 'Member') as author_name,
      fc.author_id as author_id,
      left(fc.body, 180) as preview,
      case when fc.status = 'visible' then 'published' else fc.status end as status,
      0 as like_count,
      0 as comment_count,
      fc.created_at as created_at,
      0 as engagement_score
    from public.feed_comments fc
    join public.feed_posts fp on fp.id = fc.post_id
    join public.profiles p on p.id = fc.author_id
    join public.disciplines d on d.id = fp.discipline_id
    where fc.status in ('visible', 'hidden', 'deleted')
      and (
        v_status is null
        or case when fc.status = 'visible' then 'published' else fc.status end = v_status
      )
      and (
        v_query is null
        or fc.body ilike '%' || v_query || '%'
        or p.full_name ilike '%' || v_query || '%'
        or d.display_name ilike '%' || v_query || '%'
        or fc.id::text = v_query
        or fc.post_id::text = v_query
        or fc.author_id::text = v_query
      )
  ) rows
  order by
    case when v_order = 'engagement' then rows.engagement_score end desc,
    case when v_order = 'oldest' then rows.created_at end asc,
    case when v_order <> 'oldest' then rows.created_at end desc,
    rows.target_id desc
  limit greatest(least(coalesce(p_limit, 25), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_list_feed_moderation(text, int, int, text, text) from public;
grant execute on function public.admin_list_feed_moderation(text, int, int, text, text) to authenticated;

create or replace function public.admin_list_app_member_directory(
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0,
  p_role text default null,
  p_linked_filter text default 'all',
  p_membership_filter text default 'all',
  p_order text default 'recent'
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
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := nullif(trim(p_query), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_role text := nullif(lower(trim(coalesce(p_role, ''))), '');
  v_linked_filter text := lower(coalesce(nullif(trim(p_linked_filter), ''), 'all'));
  v_membership_filter text := lower(coalesce(nullif(trim(p_membership_filter), ''), 'all'));
  v_order text := lower(coalesce(nullif(trim(p_order), ''), 'recent'));
begin
  perform public.require_admin();

  if v_role is not null and v_role not in ('admin', 'coach', 'member', 'guest') then
    v_role := null;
  end if;

  if v_linked_filter not in ('all', 'linked', 'unlinked') then
    v_linked_filter := 'all';
  end if;

  if v_membership_filter not in ('all', 'active', 'inactive') then
    v_membership_filter := 'all';
  end if;

  if v_order not in ('recent', 'points') then
    v_order := 'recent';
  end if;

  return query
  with filtered as (
    select
      p.id as user_id,
      p.full_name,
      p.role,
      p.account_status,
      p.membership_status,
      p.phone,
      p.avatar_url,
      p.created_at,
      u.email::text as email,
      ml.mindbody_client_id,
      coalesce(pa.balance, 0)::int as points_balance,
      count(*) over () as total_count
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.mindbody_links ml on ml.user_id = p.id
    left join public.points_accounts pa on pa.user_id = p.id
    where u.email::text not ilike '%@privaterelay.appleid.com'
      and (v_role is null or p.role = v_role)
      and (
        v_linked_filter = 'all'
        or (v_linked_filter = 'linked' and ml.user_id is not null)
        or (v_linked_filter = 'unlinked' and ml.user_id is null)
      )
      and (
        v_membership_filter = 'all'
        or (
          v_membership_filter = 'active'
          and lower(coalesce(p.membership_status, '')) in ('active', 'current')
        )
        or (
          v_membership_filter = 'inactive'
          and lower(coalesce(p.membership_status, '')) not in ('active', 'current')
        )
      )
      and (
        v_query is null
        or p.id::text = v_query
        or p.full_name ilike '%' || v_query || '%'
        or u.email::text ilike '%' || v_query || '%'
        or p.phone ilike '%' || v_query || '%'
        or ml.mindbody_client_id ilike '%' || v_query || '%'
      )
  )
  select
    filtered.user_id,
    filtered.full_name,
    filtered.role,
    filtered.account_status,
    filtered.membership_status,
    filtered.phone,
    filtered.avatar_url,
    filtered.created_at,
    filtered.email,
    filtered.mindbody_client_id,
    filtered.points_balance,
    filtered.total_count
  from filtered
  order by
    case when v_order = 'points' then filtered.points_balance end desc,
    case when v_order = 'recent' then filtered.created_at end desc,
    filtered.user_id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_app_member_directory(text, int, int, text, text, text, text) from public, anon;
grant execute on function public.admin_list_app_member_directory(text, int, int, text, text, text, text) to authenticated;

create or replace function public.admin_list_guardian_links(
  p_status text default null,
  p_limit int default 25,
  p_offset int default 0,
  p_query text default null,
  p_order text default 'recent'
)
returns table (
  id uuid,
  guardian_user_id uuid,
  trainee_user_id uuid,
  status text,
  child_display_name text,
  child_date_of_birth date,
  child_email text,
  child_phone text,
  mindbody_client_id text,
  request_notes text,
  requested_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  rejected_reason text,
  account_mode text,
  allow_guardian_qr boolean,
  profiles jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := nullif(lower(trim(coalesce(p_status, ''))), '');
  v_query text := nullif(trim(p_query), '');
  v_order text := lower(coalesce(nullif(trim(p_order), ''), 'recent'));
begin
  perform public.require_admin();

  if v_status is not null and v_status not in ('pending', 'approved', 'rejected', 'revoked') then
    v_status := null;
  end if;

  if v_order not in ('recent', 'oldest', 'active_first') then
    v_order := 'recent';
  end if;

  return query
  select
    gl.id,
    gl.guardian_user_id,
    gl.trainee_user_id,
    gl.status,
    gl.child_display_name,
    gl.child_date_of_birth,
    gl.child_email,
    gl.child_phone,
    gl.mindbody_client_id,
    gl.request_notes,
    gl.requested_at,
    gl.approved_by,
    gl.approved_at,
    gl.rejected_reason,
    gl.account_mode,
    gl.allow_guardian_qr,
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', u.email::text
    ) as profiles
  from public.guardian_links gl
  left join public.profiles p on p.id = gl.guardian_user_id
  left join auth.users u on u.id = gl.guardian_user_id
  where (v_status is null or gl.status = v_status)
    and (
      v_query is null
      or gl.id::text = v_query
      or gl.guardian_user_id::text = v_query
      or gl.trainee_user_id::text = v_query
      or gl.child_display_name ilike '%' || v_query || '%'
      or coalesce(gl.child_email, '') ilike '%' || v_query || '%'
      or coalesce(gl.child_phone, '') ilike '%' || v_query || '%'
      or coalesce(gl.mindbody_client_id, '') ilike '%' || v_query || '%'
      or coalesce(p.full_name, '') ilike '%' || v_query || '%'
      or coalesce(u.email::text, '') ilike '%' || v_query || '%'
    )
  order by
    case when v_order = 'active_first' and gl.status = 'approved' then 0 else 1 end,
    case when v_order = 'oldest' then gl.requested_at end asc,
    case when v_order <> 'oldest' then coalesce(gl.approved_at, gl.requested_at) end desc,
    gl.id desc
  limit greatest(least(coalesce(p_limit, 25), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_list_guardian_links(text, int, int, text, text) from public, anon;
grant execute on function public.admin_list_guardian_links(text, int, int, text, text) to authenticated;

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_old_role text;
  v_email text;
  v_existing_coach_id uuid;
  v_next_sort_order int;
begin
  perform public.require_admin();

  if p_user_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if p_role is null or p_role not in ('member', 'coach', 'admin', 'guest') then
    raise exception using message = 'INVALID_ROLE', errcode = 'P0001';
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception using message = 'CANNOT_DEMOTE_SELF', errcode = 'P0001';
  end if;

  select *
    into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  v_old_role := v_profile.role;

  update public.profiles
  set role = p_role,
      updated_at = now()
  where id = p_user_id
  returning * into v_profile;

  if p_role = 'coach' then
    select u.email::text
      into v_email
    from auth.users u
    where u.id = p_user_id;

    select c.id
      into v_existing_coach_id
    from public.coaches c
    where c.user_id = p_user_id
    limit 1;

    if v_existing_coach_id is null and v_email is not null then
      select c.id
        into v_existing_coach_id
      from public.coaches c
      where c.user_id is null
        and c.staff_email is not null
        and lower(trim(c.staff_email)) = lower(trim(v_email))
      order by c.active desc, c.created_at asc
      limit 1;
    end if;

    if v_existing_coach_id is not null then
      update public.coaches
      set user_id = p_user_id,
          staff_email = coalesce(staff_email, v_email),
          suggested_user_id = null,
          user_linked_at = now(),
          user_link_method = 'manual',
          active = true,
          deleted_at = null,
          updated_at = now()
      where id = v_existing_coach_id;
    else
      select coalesce(max(sort_order), 0) + 10
        into v_next_sort_order
      from public.coaches;

      insert into public.coaches (
        user_id,
        staff_email,
        name,
        specialty,
        rank,
        photo_url,
        is_head_coach,
        sort_order,
        visible_in_app,
        active,
        user_linked_at,
        user_link_method,
        created_at,
        updated_at
      )
      values (
        p_user_id,
        v_email,
        coalesce(nullif(trim(v_profile.full_name), ''), 'Coach'),
        null,
        'Coach',
        v_profile.avatar_url,
        false,
        v_next_sort_order,
        false,
        true,
        now(),
        'manual',
        now(),
        now()
      );
    end if;
  elsif p_role in ('member', 'guest') then
    update public.coaches
    set active = false,
        deleted_at = coalesce(deleted_at, now()),
        user_id = null,
        user_linked_at = null,
        user_link_method = null,
        updated_at = now()
    where user_id = p_user_id
      and mindbody_staff_id is null
      and slug is null;

    update public.coaches
    set user_id = null,
        user_linked_at = null,
        user_link_method = null,
        updated_at = now()
    where user_id = p_user_id
      and not (mindbody_staff_id is null and slug is null);
  end if;

  perform public.write_admin_audit(
    'set_user_role',
    'profiles',
    p_user_id::text,
    jsonb_build_object('fromRole', v_old_role, 'toRole', p_role)
  );

  return v_profile;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- Bugs are developer-only in the admin panel. Keep this enforced below the UI
-- so another admin cannot call the bug RPCs or table directly.

create or replace function public.is_bug_events_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    and exists (
      select 1
      from auth.users u
      where u.id = auth.uid()
        and lower(trim(u.email::text)) = 'bahaaeddinegueroumi@gmail.com'
    );
$$;

create or replace function public.require_bug_events_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  if not public.is_bug_events_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.is_bug_events_admin() from public, anon;
grant execute on function public.is_bug_events_admin() to authenticated;
revoke all on function public.require_bug_events_admin() from public, anon;
grant execute on function public.require_bug_events_admin() to authenticated;

drop policy if exists "bug_events select admin" on public.bug_events;
drop policy if exists "bug_events select developer admin" on public.bug_events;
create policy "bug_events select developer admin"
  on public.bug_events for select
  to authenticated
  using (public.is_bug_events_admin());

drop policy if exists "bug_events update admin" on public.bug_events;
drop policy if exists "bug_events update developer admin" on public.bug_events;
create policy "bug_events update developer admin"
  on public.bug_events for update
  to authenticated
  using (public.is_bug_events_admin())
  with check (public.is_bug_events_admin());

create or replace function public.admin_list_bug_events(
  p_status text default null,
  p_severity text default null,
  p_source text default null,
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  user_full_name text,
  user_email text,
  severity text,
  source text,
  status text,
  title text,
  message text,
  stack text,
  route text,
  release text,
  app_version text,
  app_build text,
  runtime_version text,
  platform text,
  os_version text,
  device_name text,
  connection_type text,
  is_online boolean,
  breadcrumbs jsonb,
  context jsonb,
  fingerprint text,
  admin_notes text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := nullif(trim(p_status), '');
  v_severity text := nullif(trim(p_severity), '');
  v_source text := nullif(trim(p_source), '');
  v_query text := nullif(trim(p_query), '');
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.require_bug_events_admin();

  return query
  select
    be.id,
    be.user_id,
    p.full_name as user_full_name,
    u.email::text as user_email,
    be.severity,
    be.source,
    be.status,
    be.title,
    be.message,
    be.stack,
    be.route,
    be.release,
    be.app_version,
    be.app_build,
    be.runtime_version,
    be.platform,
    be.os_version,
    be.device_name,
    be.connection_type,
    be.is_online,
    be.breadcrumbs,
    be.context,
    be.fingerprint,
    be.admin_notes,
    be.resolved_at,
    be.resolved_by,
    be.created_at,
    be.updated_at
  from public.bug_events be
  left join public.profiles p on p.id = be.user_id
  left join auth.users u on u.id = be.user_id
  where (v_status is null or be.status = v_status)
    and (v_severity is null or be.severity = v_severity)
    and (v_source is null or be.source = v_source)
    and (
      v_query is null
      or be.id::text = v_query
      or be.user_id::text = v_query
      or be.title ilike '%' || v_query || '%'
      or be.message ilike '%' || v_query || '%'
      or coalesce(be.route, '') ilike '%' || v_query || '%'
      or coalesce(be.fingerprint, '') ilike '%' || v_query || '%'
      or coalesce(p.full_name, '') ilike '%' || v_query || '%'
      or coalesce(u.email::text, '') ilike '%' || v_query || '%'
    )
  order by be.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.admin_update_bug_event(
  p_id uuid,
  p_status text,
  p_admin_notes text default null
)
returns public.bug_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_row public.bug_events;
begin
  perform public.require_bug_events_admin();

  v_status := coalesce(nullif(trim(p_status), ''), 'new');
  if v_status not in ('new', 'investigating', 'fixed', 'ignored') then
    raise exception using message = 'INVALID_STATUS', errcode = 'P0001';
  end if;

  update public.bug_events
  set
    status = v_status,
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    resolved_at = case
      when v_status in ('fixed', 'ignored') then coalesce(resolved_at, now())
      else null
    end,
    resolved_by = case
      when v_status in ('fixed', 'ignored') then auth.uid()
      else null
    end,
    updated_at = now()
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.write_admin_audit(
    'update_bug_event',
    'bug_events',
    p_id::text,
    jsonb_build_object('status', v_status)
  );

  return v_row;
end;
$$;

create or replace function public.admin_system_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_can_manage_bugs boolean;
begin
  perform public.require_admin();
  v_can_manage_bugs := public.is_bug_events_admin();

  select jsonb_build_object(
    'pendingGuardianLinks', (
      select count(*)::int
      from public.guardian_links
      where status = 'pending'
    ),
    'pendingRedemptions', (
      select count(*)::int
      from public.redemptions
      where status = 'pending'
    ),
    'pendingAccountDeletions', (
      select count(*)::int
      from public.account_deletion_requests
      where status = 'pending'
    ),
    'pendingActivations', (
      select count(*)::int
      from public.profiles
      where account_status = 'activation_required'
    ),
    'pendingActivationRequests', (
      select count(*)::int
      from public.activation_requests ar
      join auth.users u on u.id = ar.user_id
      where ar.status = 'pending'
        and u.email::text not ilike '%@privaterelay.appleid.com'
    ),
    'profilesWithoutMindbodyLink', (
      select count(*)::int
      from public.profiles p
      where p.role in ('member', 'guest')
        and not exists (
          select 1
          from public.mindbody_links ml
          where ml.user_id = p.id
        )
    ),
    'webhookEventsLast24h', (
      select count(*)::int
      from public.mindbody_webhook_events
      where received_at >= now() - interval '24 hours'
    ),
    'failedWebhookEventsLast24h', (
      select count(*)::int
      from public.mindbody_webhook_events
      where received_at >= now() - interval '24 hours'
        and status = 'failed'
    ),
    'lastWebhookReceivedAt', (
      select max(received_at)
      from public.mindbody_webhook_events
    ),
    'adminAuditEventsLast24h', (
      select count(*)::int
      from public.admin_audit_log
      where created_at >= now() - interval '24 hours'
    ),
    'syncJobsPending', (
      select count(*)::int
      from public.sync_jobs
      where status in ('pending', 'running')
    ),
    'syncJobsFailed24h', (
      select count(*)::int
      from public.sync_jobs
      where status = 'failed'
        and updated_at >= now() - interval '24 hours'
    ),
    'lastVisitSyncAt', (
      select max(r.finished_at)
      from public.sync_job_runs r
      join public.sync_jobs j on j.id = r.job_id
      where j.job_type in ('visits', 'mindbody_visits')
        and r.status = 'completed'
    ),
    'pendingGateArrivalJobs', (
      select count(*)::int
      from public.sync_jobs
      where job_type = 'mindbody_arrival'
        and status in ('pending', 'running')
    ),
    'failedGateArrivalJobs24h', (
      select count(*)::int
      from public.sync_jobs
      where job_type = 'mindbody_arrival'
        and status = 'failed'
        and updated_at >= now() - interval '24 hours'
    ),
    'recentDeniedGateAttempts24h', (
      select count(*)::int
      from public.gate_access_attempts
      where granted = false
        and responded_at >= now() - interval '24 hours'
    ),
    'lastGateAttemptAt', (
      select max(responded_at)
      from public.gate_access_attempts
    ),
    'newBugEvents', case
      when v_can_manage_bugs then (
        select count(*)::int
        from public.bug_events
        where status = 'new'
      )
      else 0
    end,
    'openBugEvents', case
      when v_can_manage_bugs then (
        select count(*)::int
        from public.bug_events
        where status in ('new', 'investigating')
      )
      else 0
    end,
    'fatalBugEvents24h', case
      when v_can_manage_bugs then (
        select count(*)::int
        from public.bug_events
        where severity = 'fatal'
          and status in ('new', 'investigating')
          and created_at >= now() - interval '24 hours'
      )
      else 0
    end,
    'recentFailedSyncJobs', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', j.id,
            'jobType', j.job_type,
            'errorMessage', j.error_message,
            'updatedAt', j.updated_at
          )
          order by j.updated_at desc
        )
        from (
          select id, job_type, error_message, updated_at
          from public.sync_jobs
          where status = 'failed'
          order by updated_at desc
          limit 5
        ) j
      ),
      '[]'::jsonb
    ),
    'recentFailedWebhooks', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'eventType', e.event_type,
            'receivedAt', e.received_at
          )
          order by e.received_at desc
        )
        from (
          select id, event_type, received_at
          from public.mindbody_webhook_events
          where status = 'failed'
          order by received_at desc
          limit 5
        ) e
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_list_bug_events(text, text, text, text, int, int) from public, anon;
grant execute on function public.admin_list_bug_events(text, text, text, text, int, int) to authenticated;
revoke all on function public.admin_update_bug_event(uuid, text, text) from public, anon;
grant execute on function public.admin_update_bug_event(uuid, text, text) to authenticated;
revoke execute on function public.admin_system_health() from public, anon;
grant execute on function public.admin_system_health() to authenticated;
