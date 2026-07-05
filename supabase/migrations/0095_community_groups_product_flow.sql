-- Community groups product flow:
-- discipline communities, coach-managed public/private groups, intentional member joins,
-- and private group member management.

alter table public.community_channels
  add column if not exists visibility text not null default 'public';

do $$
begin
  alter table public.community_channels
    add constraint community_channels_visibility_check
    check (visibility in ('public', 'private'));
exception
  when duplicate_object then null;
end $$;

alter table public.community_channels
  drop constraint if exists community_channels_coach_id_discipline_id_key;

create index if not exists idx_community_channels_coach_discipline_active
  on public.community_channels (coach_id, discipline_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_community_channels_discoverable
  on public.community_channels (visibility, discipline_id, status, created_at desc)
  where deleted_at is null;

create index if not exists idx_community_memberships_channel_joined
  on public.community_memberships (channel_id, joined_at)
  where joined_at is not null;

create or replace function public.has_valid_academy_membership(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user
      and p.role = 'member'
      and p.membership_status = 'active'
      and (p.membership_expires_at is null or p.membership_expires_at >= now())
  )
  or exists (
    select 1
    from public.member_memberships mm
    join public.profiles p on p.id = mm.user_id
    where mm.user_id = p_user
      and p.role = 'member'
      and lower(mm.status) in ('active', 'current')
      and (mm.end_date is null or mm.end_date >= now())
  );
$$;

create or replace function public.member_can_discover_discipline(
  p_user uuid,
  p_discipline_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null
    and p_discipline_id is not null
    and exists (
      select 1
      from public.disciplines d
      where d.id = p_discipline_id
        and d.active = true
    )
    and (
      -- 971 MMA memberships are academy memberships. A valid member can train
      -- every discipline, so public group discovery is not blocked by missing
      -- per-discipline sync data.
      public.has_valid_academy_membership(p_user)
      or exists (
        select 1
        from public.member_disciplines md
        where md.user_id = p_user
          and md.discipline_id = p_discipline_id
          and md.active = true
      )
      or exists (
        select 1
        from public.check_ins ci
        join public.classes c on c.id = ci.class_id
        where ci.user_id = p_user
          and c.discipline_id = p_discipline_id
          and ci.signed_in = true
          and coalesce(ci.missed, false) = false
          and coalesce(ci.late_cancelled, false) = false
      )
      or exists (
        select 1
        from public.member_memberships mm
        join public.membership_product_disciplines mpd
          on mpd.active = true
         and mpd.discipline_id = p_discipline_id
         and (
           (mpd.match_type = 'mindbody_id' and mm.mindbody_record_id = mpd.match_value)
           or (mpd.match_type = 'name_exact' and lower(trim(mm.name)) = lower(trim(mpd.match_value)))
           or (mpd.match_type = 'name_contains' and mm.name ilike '%' || mpd.match_value || '%')
         )
        where mm.user_id = p_user
          and lower(mm.status) in ('active', 'current')
          and (mm.end_date is null or mm.end_date >= now())
      )
    );
$$;

create or replace function public.can_access_community_channel(
  p_channel_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_channels ch
    where ch.id = p_channel_id
      and ch.deleted_at is null
      and ch.status = 'active'
      and (
        public.is_admin()
        or exists (
          select 1
          from public.coaches c
          where c.id = ch.coach_id
            and c.user_id = p_user_id
            and c.active = true
            and c.deleted_at is null
        )
        or (
          public.has_valid_academy_membership(p_user_id)
          and exists (
            select 1
            from public.community_memberships cm
            where cm.channel_id = ch.id
              and cm.user_id = p_user_id
              and cm.joined_at is not null
          )
        )
      )
  );
$$;

create or replace function public.community_eligible_channel_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select ch.id
  from public.community_channels ch
  where ch.status = 'active'
    and ch.deleted_at is null
    and (
      exists (
        select 1
        from public.coaches co
        where co.id = ch.coach_id
          and co.user_id = p_user
          and co.active = true
          and co.deleted_at is null
      )
      or (
        public.has_valid_academy_membership(p_user)
        and exists (
          select 1
          from public.community_memberships cm
          where cm.channel_id = ch.id
            and cm.user_id = p_user
            and cm.joined_at is not null
        )
      )
      or (
        ch.visibility = 'public'
        and public.member_can_discover_discipline(p_user, ch.discipline_id)
      )
    );
$$;

create or replace function public.sync_community_memberships(p_user uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_changed int := 0;
  v_count int := 0;
begin
  if v_user is null then
    return 0;
  end if;

  -- Coaches always belong to groups they own so read-state and push exclusions
  -- behave consistently, but regular members join intentionally.
  insert into public.community_memberships (channel_id, user_id, joined_at)
  select ch.id, v_user, now()
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  where ch.status = 'active'
    and ch.deleted_at is null
    and co.active = true
    and co.deleted_at is null
    and co.user_id = v_user
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  get diagnostics v_count = row_count;
  v_changed := v_changed + v_count;

  -- Expired members keep the historical row, but lose active access until a
  -- valid membership returns or the coach adds them again after renewal.
  update public.community_memberships cm
  set joined_at = null,
      updated_at = now()
  where cm.user_id = v_user
    and cm.joined_at is not null
    and not exists (
      select 1
      from public.community_channels ch
      join public.coaches co on co.id = ch.coach_id
      where ch.id = cm.channel_id
        and co.user_id = v_user
        and co.active = true
        and co.deleted_at is null
    )
    and (
      not public.has_valid_academy_membership(v_user)
      or not exists (
        select 1
        from public.community_channels ch
        where ch.id = cm.channel_id
          and ch.status = 'active'
          and ch.deleted_at is null
      )
    );

  get diagnostics v_count = row_count;
  v_changed := v_changed + v_count;

  return v_changed;
end;
$$;

create or replace function public.ensure_coach_community_channel(
  p_coach_id uuid,
  p_discipline_id uuid
)
returns public.community_channels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.community_channels;
  v_coach public.coaches%rowtype;
  v_discipline public.disciplines%rowtype;
begin
  select * into v_coach
  from public.coaches
  where id = p_coach_id
    and active = true
    and deleted_at is null;
  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select * into v_discipline
  from public.disciplines
  where id = p_discipline_id
    and active = true;
  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select * into v_row
  from public.community_channels
  where coach_id = p_coach_id
    and discipline_id = p_discipline_id
    and deleted_at is null
  order by created_at asc
  limit 1;

  if v_row.id is null then
    insert into public.community_channels (
      coach_id,
      discipline_id,
      title,
      description,
      visibility,
      status
    )
    values (
      p_coach_id,
      p_discipline_id,
      v_coach.name || ' · ' || v_discipline.display_name,
      null,
      'public',
      'active'
    )
    returning * into v_row;
  elsif v_row.status = 'archived' then
    update public.community_channels
    set status = 'active',
        deleted_at = null,
        updated_at = now()
    where id = v_row.id
    returning * into v_row;
  end if;

  if v_coach.user_id is not null then
    insert into public.community_memberships (channel_id, user_id, joined_at)
    values (v_row.id, v_coach.user_id, now())
    on conflict (channel_id, user_id) do update
    set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
        updated_at = now();
  end if;

  return v_row;
end;
$$;

create or replace function public.community_channel_summary_json(
  p_channel_id uuid,
  p_viewer_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', ch.id,
    'title', ch.title,
    'description', ch.description,
    'visibility', ch.visibility,
    'disciplineId', d.id,
    'disciplineName', d.display_name,
    'disciplineSlug', d.slug,
    'coachId', co.id,
    'coachName', co.name,
    'coachAvatarUrl', p.avatar_url,
    'latestPostAt', latest.published_at,
    'lastMessageAt', latest.published_at,
    'lastMessagePreview', latest.preview,
    'unreadCount', coalesce(unread.cnt, 0),
    'memberCount', member_counts.cnt,
    'isCoachOwner', co.user_id = p_viewer_id,
    'joinedAt', cm.joined_at,
    'canJoin', ch.visibility = 'public'
      and cm.joined_at is null
      and public.member_can_discover_discipline(p_viewer_id, ch.discipline_id)
  )
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  join public.disciplines d on d.id = ch.discipline_id
  left join public.profiles p on p.id = co.user_id
  left join public.community_memberships cm
    on cm.channel_id = ch.id
   and cm.user_id = p_viewer_id
  left join lateral (
    select
      cp.published_at,
      left(coalesce(nullif(trim(cp.title), ''), cp.body), 120) as preview
    from public.community_posts cp
    where cp.channel_id = ch.id
      and cp.status = 'published'
      and cp.deleted_at is null
    order by cp.published_at desc
    limit 1
  ) latest on true
  left join lateral (
    select count(*)::int as cnt
    from public.community_posts cp_unread
    where cp_unread.channel_id = ch.id
      and cp_unread.status = 'published'
      and cp_unread.deleted_at is null
      and cp_unread.published_at > coalesce(cm.last_read_at, cm.joined_at, '-infinity'::timestamptz)
  ) unread on true
  left join lateral (
    select count(*)::int as cnt
    from public.community_memberships cm2
    where cm2.channel_id = ch.id
      and cm2.joined_at is not null
  ) member_counts on true
  where ch.id = p_channel_id
    and ch.deleted_at is null;
$$;

create or replace function public.list_community_channels()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_channels jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  perform public.sync_community_memberships(v_user);

  select coalesce(
    jsonb_agg(
      public.community_channel_summary_json(ch.id, v_user)
      order by coalesce(latest.published_at, cm.joined_at, ch.created_at) desc
    ),
    '[]'::jsonb
  )
  into v_channels
  from public.community_channels ch
  join public.community_memberships cm
    on cm.channel_id = ch.id
   and cm.user_id = v_user
   and cm.joined_at is not null
  left join lateral (
    select cp.published_at
    from public.community_posts cp
    where cp.channel_id = ch.id
      and cp.status = 'published'
      and cp.deleted_at is null
    order by cp.published_at desc
    limit 1
  ) latest on true
  where ch.status = 'active'
    and ch.deleted_at is null
    and public.can_access_community_channel(ch.id, v_user);

  return jsonb_build_object('channels', v_channels);
end;
$$;

create or replace function public.list_discoverable_community_channels()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_channels jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  perform public.sync_community_memberships(v_user);

  select coalesce(
    jsonb_agg(
      public.community_channel_summary_json(ch.id, v_user)
      order by d.sort_order asc, co.name asc, ch.created_at desc
    ),
    '[]'::jsonb
  )
  into v_channels
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  join public.disciplines d on d.id = ch.discipline_id
  left join public.community_memberships cm
    on cm.channel_id = ch.id
   and cm.user_id = v_user
   and cm.joined_at is not null
  where ch.status = 'active'
    and ch.deleted_at is null
    and ch.visibility = 'public'
    and cm.id is null
    and public.member_can_discover_discipline(v_user, ch.discipline_id);

  return jsonb_build_object('channels', v_channels);
end;
$$;

create or replace function public.join_public_community_channel(p_channel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_channel public.community_channels%rowtype;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  select * into v_channel
  from public.community_channels
  where id = p_channel_id
    and status = 'active'
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_channel.visibility <> 'public' then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.has_valid_academy_membership(v_user)
     or not public.member_can_discover_discipline(v_user, v_channel.discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  insert into public.community_memberships (channel_id, user_id, invited_at, joined_at)
  values (p_channel_id, v_user, now(), now())
  on conflict (channel_id, user_id) do update
  set joined_at = now(),
      muted_at = null,
      updated_at = now();

  return public.community_channel_summary_json(p_channel_id, v_user);
end;
$$;

create or replace function public.leave_community_channel(p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.community_channels ch
    join public.coaches co on co.id = ch.coach_id
    where ch.id = p_channel_id
      and co.user_id = v_user
  ) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  update public.community_memberships
  set joined_at = null,
      updated_at = now()
  where channel_id = p_channel_id
    and user_id = v_user;
end;
$$;

create or replace function public.list_coach_community_channels(p_coach_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_coach_id uuid := coalesce(p_coach_id, public.coach_id_for_user());
  v_channels jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if v_coach_id is null then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.is_admin()
     and not exists (
      select 1
      from public.coaches co
      where co.id = v_coach_id
        and co.user_id = v_user
        and co.active = true
        and co.deleted_at is null
    ) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  insert into public.community_memberships (channel_id, user_id, joined_at)
  select ch.id, v_user, now()
  from public.community_channels ch
  where ch.coach_id = v_coach_id
    and ch.status = 'active'
    and ch.deleted_at is null
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  select coalesce(
    jsonb_agg(
      public.community_channel_summary_json(ch.id, v_user)
      order by coalesce(latest.published_at, ch.created_at) desc
    ),
    '[]'::jsonb
  )
  into v_channels
  from public.community_channels ch
  left join lateral (
    select cp.published_at
    from public.community_posts cp
    where cp.channel_id = ch.id
      and cp.status = 'published'
      and cp.deleted_at is null
    order by cp.published_at desc
    limit 1
  ) latest on true
  where ch.coach_id = v_coach_id
    and ch.status = 'active'
    and ch.deleted_at is null;

  return jsonb_build_object('channels', v_channels);
end;
$$;

create or replace function public.list_coach_group_disciplines(p_coach_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_coach_id uuid := coalesce(p_coach_id, public.coach_id_for_user());
  v_disciplines jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() or v_coach_id is null then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.is_admin()
     and not exists (
      select 1
      from public.coaches co
      where co.id = v_coach_id
        and co.user_id = v_user
        and co.active = true
        and co.deleted_at is null
    ) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if exists (select 1 from public.coach_disciplines cd where cd.coach_id = v_coach_id) then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'name', d.display_name,
          'slug', d.slug
        )
        order by d.sort_order asc, d.display_name asc
      ),
      '[]'::jsonb
    )
    into v_disciplines
    from public.coach_disciplines cd
    join public.disciplines d on d.id = cd.discipline_id
    where cd.coach_id = v_coach_id
      and d.active = true;
  else
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'name', d.display_name,
          'slug', d.slug
        )
        order by d.sort_order asc, d.display_name asc
      ),
      '[]'::jsonb
    )
    into v_disciplines
    from public.disciplines d
    where d.active = true;
  end if;

  return jsonb_build_object('disciplines', v_disciplines);
end;
$$;

create or replace function public.assert_coach_owns_community_group(
  p_channel_id uuid,
  p_coach_id uuid default null
)
returns public.community_channels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_coach_id uuid := coalesce(p_coach_id, public.coach_id_for_user());
  v_channel public.community_channels%rowtype;
begin
  if v_user is null or v_coach_id is null then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select * into v_channel
  from public.community_channels
  where id = p_channel_id
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_channel.coach_id <> v_coach_id then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.coach_has_discipline_access(v_coach_id, v_channel.discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  return v_channel;
end;
$$;

create or replace function public.community_member_json(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'fullName', coalesce(p.full_name, 'Member'),
    'email', u.email,
    'avatarUrl', p.avatar_url,
    'membershipStatus', p.membership_status,
    'membershipExpiresAt', p.membership_expires_at
  )
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_user;
$$;

create or replace function public.create_community_group(
  p_coach_id uuid,
  p_discipline_id uuid,
  p_title text,
  p_description text default null,
  p_visibility text default 'public',
  p_member_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_coach_id uuid := coalesce(p_coach_id, public.coach_id_for_user());
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_visibility text := lower(trim(coalesce(p_visibility, 'public')));
  v_channel public.community_channels%rowtype;
  v_invalid_count int := 0;
begin
  if v_user is null or v_coach_id is null then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.is_admin()
     and not exists (
      select 1
      from public.coaches co
      where co.id = v_coach_id
        and co.user_id = v_user
        and co.active = true
        and co.deleted_at is null
    ) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if v_title is null or char_length(v_title) > 80 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_description is not null and char_length(v_description) > 240 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_visibility not in ('public', 'private') then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if p_discipline_id is null
     or not exists (select 1 from public.disciplines where id = p_discipline_id and active = true)
     or not public.coach_has_discipline_access(v_coach_id, p_discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select count(*)::int
    into v_invalid_count
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as member_id
  ) selected
  where selected.member_id is not null
    and not public.has_valid_academy_membership(selected.member_id);

  if v_invalid_count > 0 then
    raise exception using message = 'INVALID_MEMBERS', errcode = 'P0001';
  end if;

  insert into public.community_channels (
    coach_id,
    discipline_id,
    title,
    description,
    visibility,
    status
  )
  values (
    v_coach_id,
    p_discipline_id,
    v_title,
    v_description,
    v_visibility,
    'active'
  )
  returning * into v_channel;

  insert into public.community_memberships (channel_id, user_id, joined_at)
  values (v_channel.id, v_user, now())
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  insert into public.community_memberships (channel_id, user_id, invited_at, joined_at)
  select v_channel.id, selected.member_id, now(), now()
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as member_id
  ) selected
  where selected.member_id is not null
    and selected.member_id <> v_user
  on conflict (channel_id, user_id) do update
  set joined_at = now(),
      muted_at = null,
      updated_at = now();

  insert into public.notifications (user_id, type, payload)
  select
    selected.member_id,
    'community',
    jsonb_build_object(
      'title', 'Added to group',
      'body', v_title,
      'channelId', v_channel.id,
      'url', '/communities/' || v_channel.id::text
    )
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as member_id
  ) selected
  where selected.member_id is not null
    and selected.member_id <> v_user
    and coalesce(public.notification_enabled(selected.member_id, 'community'), true);

  return public.community_channel_summary_json(v_channel.id, v_user);
end;
$$;

create or replace function public.update_community_group(
  p_channel_id uuid,
  p_coach_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_visibility text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_channel public.community_channels%rowtype;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_visibility text := nullif(lower(trim(coalesce(p_visibility, ''))), '');
begin
  v_channel := public.assert_coach_owns_community_group(p_channel_id, p_coach_id);

  if v_title is not null and char_length(v_title) > 80 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_description is not null and char_length(v_description) > 240 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_visibility is not null and v_visibility not in ('public', 'private') then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  update public.community_channels
  set title = coalesce(v_title, title),
      description = case when p_description is null then description else v_description end,
      visibility = coalesce(v_visibility, visibility),
      updated_at = now()
  where id = v_channel.id
  returning * into v_channel;

  return public.community_channel_summary_json(v_channel.id, v_user);
end;
$$;

create or replace function public.archive_community_group(
  p_channel_id uuid,
  p_coach_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel public.community_channels%rowtype;
begin
  v_channel := public.assert_coach_owns_community_group(p_channel_id, p_coach_id);

  update public.community_channels
  set status = 'archived',
      deleted_at = now(),
      updated_at = now()
  where id = v_channel.id;
end;
$$;

create or replace function public.list_community_group_members(
  p_channel_id uuid,
  p_coach_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel public.community_channels%rowtype;
  v_members jsonb := '[]'::jsonb;
begin
  v_channel := public.assert_coach_owns_community_group(p_channel_id, p_coach_id);

  select coalesce(
    jsonb_agg(
      public.community_member_json(cm.user_id)
      || jsonb_build_object(
        'joinedAt', cm.joined_at,
        'isCoach', co.user_id = cm.user_id
      )
      order by (co.user_id = cm.user_id) desc, p.full_name asc
    ),
    '[]'::jsonb
  )
  into v_members
  from public.community_memberships cm
  join public.profiles p on p.id = cm.user_id
  left join public.coaches co on co.id = v_channel.coach_id
  where cm.channel_id = v_channel.id
    and cm.joined_at is not null;

  return jsonb_build_object('members', v_members);
end;
$$;

create or replace function public.search_community_group_member_candidates(
  p_channel_id uuid,
  p_query text default null,
  p_limit int default 20,
  p_coach_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel public.community_channels%rowtype;
  v_query text := nullif(trim(coalesce(p_query, '')), '');
  v_limit int := greatest(least(coalesce(p_limit, 20), 50), 1);
  v_members jsonb := '[]'::jsonb;
begin
  v_channel := public.assert_coach_owns_community_group(p_channel_id, p_coach_id);

  select coalesce(
    jsonb_agg(
      public.community_member_json(p.id)
      order by p.full_name asc
    ),
    '[]'::jsonb
  )
  into v_members
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.mindbody_links ml on ml.user_id = p.id
  where p.role = 'member'
    and public.has_valid_academy_membership(p.id)
    and not exists (
      select 1
      from public.community_memberships cm
      where cm.channel_id = v_channel.id
        and cm.user_id = p.id
        and cm.joined_at is not null
    )
    and (
      v_query is null
      or p.full_name ilike '%' || v_query || '%'
      or u.email ilike '%' || v_query || '%'
      or ml.mindbody_client_id ilike '%' || v_query || '%'
    )
  limit v_limit;

  return jsonb_build_object('members', v_members);
end;
$$;

create or replace function public.search_community_member_candidates(
  p_query text default null,
  p_limit int default 20,
  p_coach_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_coach_id uuid := coalesce(p_coach_id, public.coach_id_for_user());
  v_query text := nullif(trim(coalesce(p_query, '')), '');
  v_limit int := greatest(least(coalesce(p_limit, 20), 50), 1);
  v_members jsonb := '[]'::jsonb;
begin
  if v_user is null or v_coach_id is null then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.is_admin()
     and not exists (
      select 1
      from public.coaches co
      where co.id = v_coach_id
        and co.user_id = v_user
        and co.active = true
        and co.deleted_at is null
    ) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select coalesce(
    jsonb_agg(
      public.community_member_json(p.id)
      order by p.full_name asc
    ),
    '[]'::jsonb
  )
  into v_members
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.mindbody_links ml on ml.user_id = p.id
  where p.role = 'member'
    and public.has_valid_academy_membership(p.id)
    and (
      v_query is null
      or p.full_name ilike '%' || v_query || '%'
      or u.email ilike '%' || v_query || '%'
      or ml.mindbody_client_id ilike '%' || v_query || '%'
    )
  limit v_limit;

  return jsonb_build_object('members', v_members);
end;
$$;

create or replace function public.add_community_group_members(
  p_channel_id uuid,
  p_member_ids uuid[],
  p_coach_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel public.community_channels%rowtype;
  v_invalid_count int := 0;
begin
  v_channel := public.assert_coach_owns_community_group(p_channel_id, p_coach_id);

  select count(*)::int
    into v_invalid_count
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as member_id
  ) selected
  where selected.member_id is not null
    and not public.has_valid_academy_membership(selected.member_id);

  if v_invalid_count > 0 then
    raise exception using message = 'INVALID_MEMBERS', errcode = 'P0001';
  end if;

  insert into public.community_memberships (channel_id, user_id, invited_at, joined_at)
  select v_channel.id, selected.member_id, now(), now()
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as member_id
  ) selected
  where selected.member_id is not null
  on conflict (channel_id, user_id) do update
  set joined_at = now(),
      muted_at = null,
      updated_at = now();

  insert into public.notifications (user_id, type, payload)
  select
    selected.member_id,
    'community',
    jsonb_build_object(
      'title', 'Added to group',
      'body', v_channel.title,
      'channelId', v_channel.id,
      'url', '/communities/' || v_channel.id::text
    )
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as member_id
  ) selected
  where selected.member_id is not null
    and coalesce(public.notification_enabled(selected.member_id, 'community'), true);

  return public.list_community_group_members(v_channel.id, v_channel.coach_id);
end;
$$;

create or replace function public.remove_community_group_member(
  p_channel_id uuid,
  p_member_id uuid,
  p_coach_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel public.community_channels%rowtype;
  v_coach_user uuid;
begin
  v_channel := public.assert_coach_owns_community_group(p_channel_id, p_coach_id);

  select co.user_id into v_coach_user
  from public.coaches co
  where co.id = v_channel.coach_id;

  if p_member_id is null or p_member_id = v_coach_user then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  update public.community_memberships
  set joined_at = null,
      updated_at = now()
  where channel_id = v_channel.id
    and user_id = p_member_id;

  return public.list_community_group_members(v_channel.id, v_channel.coach_id);
end;
$$;

create or replace function public.get_community_channel_header(p_channel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_pinned uuid;
  v_header jsonb;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if not public.can_access_community_channel(p_channel_id, v_user) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select cp.id
    into v_pinned
  from public.community_posts cp
  where cp.channel_id = p_channel_id
    and cp.is_pinned = true
    and cp.status = 'published'
    and cp.deleted_at is null
  order by cp.pinned_at desc nulls last, cp.published_at desc
  limit 1;

  select public.community_channel_summary_json(ch.id, v_user)
    || jsonb_build_object(
      'pinnedPost', case
        when v_pinned is null then null
        else public.community_post_as_json(v_pinned, v_user)
      end
    )
  into v_header
  from public.community_channels ch
  where ch.id = p_channel_id
    and ch.deleted_at is null;

  if v_header is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  return v_header;
end;
$$;

create or replace function public.publish_community_post(
  p_channel_id uuid,
  p_title text default null,
  p_body text default null,
  p_coach_id uuid default null,
  p_post_kind text default 'announcement',
  p_pin_on_publish boolean default false
)
returns public.community_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_coach_id uuid := coalesce(p_coach_id, public.coach_id_for_user());
  v_channel public.community_channels%rowtype;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_body text := trim(coalesce(p_body, ''));
  v_post_kind text := coalesce(nullif(trim(coalesce(p_post_kind, '')), ''), 'announcement');
  v_post public.community_posts%rowtype;
begin
  if v_user is null or v_coach_id is null then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if v_body = '' then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_post_kind not in ('announcement', 'system') then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select * into v_channel
  from public.community_channels
  where id = p_channel_id
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_channel.coach_id <> v_coach_id then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.coach_has_discipline_access(v_coach_id, v_channel.discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if v_channel.status <> 'active' then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if p_pin_on_publish then
    perform public._community_unpin_channel_posts(v_channel.id);
  end if;

  insert into public.community_posts (
    channel_id,
    author_id,
    title,
    body,
    post_kind,
    is_pinned,
    pinned_at,
    status,
    published_at
  )
  values (
    v_channel.id,
    v_user,
    v_title,
    v_body,
    v_post_kind,
    p_pin_on_publish,
    case when p_pin_on_publish then now() else null end,
    'published',
    now()
  )
  returning * into v_post;

  insert into public.notifications (user_id, type, payload)
  select
    cm.user_id,
    'community',
    jsonb_build_object(
      'title', coalesce(v_title, 'New announcement'),
      'body', left(v_body, 180),
      'channelId', v_channel.id,
      'postId', v_post.id,
      'postKind', v_post_kind,
      'url', '/communities/post/' || v_post.id::text
    )
  from public.community_memberships cm
  where cm.channel_id = v_channel.id
    and cm.user_id <> v_user
    and cm.joined_at is not null
    and cm.muted_at is null
    and (
      exists (select 1 from public.coaches co where co.id = v_channel.coach_id and co.user_id = cm.user_id)
      or public.has_valid_academy_membership(cm.user_id)
    )
    and coalesce(public.notification_enabled(cm.user_id, 'community'), true);

  return v_post;
end;
$$;

create or replace function public.get_community_push_recipients(
  p_post_id uuid default null,
  p_reply_id uuid default null,
  p_exclude_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_post_id uuid;
  v_title text;
  v_body text;
  v_url text;
  v_user_ids uuid[];
begin
  if p_post_id is null and p_reply_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if p_reply_id is not null then
    select
      cp.id,
      cp.channel_id,
      coalesce(n.payload ->> 'title', 'New reply'),
      coalesce(n.payload ->> 'body', left(cr.body, 180)),
      '/communities/post/' || cp.id::text
    into v_post_id, v_channel_id, v_title, v_body, v_url
    from public.community_replies cr
    join public.community_posts cp on cp.id = cr.post_id
    left join lateral (
      select payload
      from public.notifications n
      where n.type = 'community'
        and n.payload ->> 'replyId' = cr.id::text
      order by n.created_at desc
      limit 1
    ) n on true
    where cr.id = p_reply_id
      and cr.status = 'visible'
      and cr.deleted_at is null;
  else
    select
      cp.id,
      cp.channel_id,
      coalesce(nullif(trim(cp.title), ''), 'New announcement'),
      left(cp.body, 180),
      '/communities/post/' || cp.id::text
    into v_post_id, v_channel_id, v_title, v_body, v_url
    from public.community_posts cp
    where cp.id = p_post_id
      and cp.status = 'published'
      and cp.deleted_at is null;
  end if;

  if v_channel_id is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if p_reply_id is not null then
    select array_agg(distinct n.user_id)
      into v_user_ids
    from public.notifications n
    where n.type = 'community'
      and n.payload ->> 'replyId' = p_reply_id::text
      and n.user_id is distinct from p_exclude_user_id
      and (
        public.has_valid_academy_membership(n.user_id)
        or exists (
          select 1
          from public.community_channels ch
          join public.coaches co on co.id = ch.coach_id
          where ch.id = v_channel_id
            and co.user_id = n.user_id
        )
      );
  else
    select array_agg(distinct cm.user_id)
      into v_user_ids
    from public.community_memberships cm
    where cm.channel_id = v_channel_id
      and cm.joined_at is not null
      and cm.muted_at is null
      and cm.user_id is distinct from p_exclude_user_id
      and (
        public.has_valid_academy_membership(cm.user_id)
        or exists (
          select 1
          from public.community_channels ch
          join public.coaches co on co.id = ch.coach_id
          where ch.id = v_channel_id
            and co.user_id = cm.user_id
        )
      )
      and coalesce(public.notification_enabled(cm.user_id, 'community'), true);
  end if;

  return jsonb_build_object(
    'userIds', coalesce(to_jsonb(v_user_ids), '[]'::jsonb),
    'title', v_title,
    'body', v_body,
    'channelId', v_channel_id,
    'postId', v_post_id,
    'url', v_url
  );
end;
$$;

drop function if exists public.admin_manage_community_channel(uuid, uuid, text);
drop function if exists public.admin_manage_community_channel(uuid, uuid, text, uuid);
drop function if exists public.admin_list_community_channels(int, int);

create or replace function public.admin_list_community_channels(
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  title text,
  description text,
  visibility text,
  status text,
  coach_id uuid,
  coach_name text,
  discipline_id uuid,
  discipline_name text,
  member_count int,
  post_count int,
  latest_post_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select
    ch.id,
    ch.title,
    ch.description,
    ch.visibility,
    ch.status,
    co.id,
    co.name,
    d.id,
    d.display_name,
    coalesce(members.cnt, 0)::int,
    coalesce(posts.cnt, 0)::int,
    latest.published_at,
    ch.created_at
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  join public.disciplines d on d.id = ch.discipline_id
  left join lateral (
    select count(*)::int as cnt
    from public.community_memberships cm
    where cm.channel_id = ch.id and cm.joined_at is not null
  ) members on true
  left join lateral (
    select count(*)::int as cnt
    from public.community_posts cp
    where cp.channel_id = ch.id and cp.deleted_at is null and cp.status = 'published'
  ) posts on true
  left join lateral (
    select cp.published_at
    from public.community_posts cp
    where cp.channel_id = ch.id and cp.deleted_at is null and cp.status = 'published'
    order by cp.published_at desc
    limit 1
  ) latest on true
  where ch.deleted_at is null
  order by coalesce(latest.published_at, ch.created_at) desc
  limit greatest(least(coalesce(p_limit, 50), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_manage_community_channel(
  p_coach_id uuid,
  p_discipline_id uuid,
  p_action text default 'ensure',
  p_channel_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.community_channels%rowtype;
  v_action text := lower(trim(coalesce(p_action, 'ensure')));
begin
  perform public.require_admin();

  if v_action = 'ensure' then
    if p_coach_id is null or p_discipline_id is null then
      raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
    end if;

    v_row := public.ensure_coach_community_channel(p_coach_id, p_discipline_id);

    insert into public.coach_disciplines (coach_id, discipline_id)
    values (p_coach_id, p_discipline_id)
    on conflict do nothing;

    return jsonb_build_object(
      'id', v_row.id,
      'title', v_row.title,
      'status', v_row.status,
      'visibility', v_row.visibility,
      'action', 'ensure'
    );
  end if;

  select * into v_row
  from public.community_channels
  where deleted_at is null
    and (
      (p_channel_id is not null and id = p_channel_id)
      or (
        p_channel_id is null
        and coach_id = p_coach_id
        and discipline_id = p_discipline_id
      )
    )
  order by created_at asc
  limit 1;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_action = 'archive' then
    update public.community_channels
    set status = 'archived', updated_at = now()
    where id = v_row.id
    returning * into v_row;
  elsif v_action = 'restore' then
    update public.community_channels
    set status = 'active', deleted_at = null, updated_at = now()
    where id = v_row.id
    returning * into v_row;
  elsif v_action = 'delete' then
    update public.community_channels
    set deleted_at = now(), status = 'archived', updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'title', v_row.title,
    'status', v_row.status,
    'visibility', v_row.visibility,
    'action', v_action
  );
end;
$$;

revoke all on function public.has_valid_academy_membership(uuid) from public, anon;
revoke all on function public.member_can_discover_discipline(uuid, uuid) from public, anon;
revoke all on function public.community_eligible_channel_ids(uuid) from public, anon;
revoke all on function public.sync_community_memberships(uuid) from public, anon;
revoke all on function public.ensure_coach_community_channel(uuid, uuid) from public, anon;
revoke all on function public.community_channel_summary_json(uuid, uuid) from public, anon;
revoke all on function public.list_community_channels() from public, anon;
revoke all on function public.list_discoverable_community_channels() from public, anon;
revoke all on function public.join_public_community_channel(uuid) from public, anon;
revoke all on function public.leave_community_channel(uuid) from public, anon;
revoke all on function public.list_coach_community_channels(uuid) from public, anon;
revoke all on function public.list_coach_group_disciplines(uuid) from public, anon;
revoke all on function public.assert_coach_owns_community_group(uuid, uuid) from public, anon;
revoke all on function public.community_member_json(uuid) from public, anon;
revoke all on function public.create_community_group(uuid, uuid, text, text, text, uuid[]) from public, anon;
revoke all on function public.update_community_group(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.archive_community_group(uuid, uuid) from public, anon;
revoke all on function public.list_community_group_members(uuid, uuid) from public, anon;
revoke all on function public.search_community_group_member_candidates(uuid, text, int, uuid) from public, anon;
revoke all on function public.search_community_member_candidates(text, int, uuid) from public, anon;
revoke all on function public.add_community_group_members(uuid, uuid[], uuid) from public, anon;
revoke all on function public.remove_community_group_member(uuid, uuid, uuid) from public, anon;
revoke all on function public.admin_list_community_channels(int, int) from public, anon;
revoke all on function public.admin_manage_community_channel(uuid, uuid, text, uuid) from public, anon;

grant execute on function public.has_valid_academy_membership(uuid) to authenticated, service_role;
grant execute on function public.member_can_discover_discipline(uuid, uuid) to authenticated, service_role;
grant execute on function public.community_eligible_channel_ids(uuid) to authenticated, service_role;
grant execute on function public.sync_community_memberships(uuid) to authenticated;
grant execute on function public.ensure_coach_community_channel(uuid, uuid) to authenticated;
grant execute on function public.community_channel_summary_json(uuid, uuid) to authenticated;
grant execute on function public.list_community_channels() to authenticated;
grant execute on function public.list_discoverable_community_channels() to authenticated;
grant execute on function public.join_public_community_channel(uuid) to authenticated;
grant execute on function public.leave_community_channel(uuid) to authenticated;
grant execute on function public.list_coach_community_channels(uuid) to authenticated;
grant execute on function public.list_coach_group_disciplines(uuid) to authenticated;
grant execute on function public.assert_coach_owns_community_group(uuid, uuid) to authenticated;
grant execute on function public.community_member_json(uuid) to authenticated;
grant execute on function public.create_community_group(uuid, uuid, text, text, text, uuid[]) to authenticated;
grant execute on function public.update_community_group(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.archive_community_group(uuid, uuid) to authenticated;
grant execute on function public.list_community_group_members(uuid, uuid) to authenticated;
grant execute on function public.search_community_group_member_candidates(uuid, text, int, uuid) to authenticated;
grant execute on function public.search_community_member_candidates(text, int, uuid) to authenticated;
grant execute on function public.add_community_group_members(uuid, uuid[], uuid) to authenticated;
grant execute on function public.remove_community_group_member(uuid, uuid, uuid) to authenticated;
grant execute on function public.admin_list_community_channels(int, int) to authenticated;
grant execute on function public.admin_manage_community_channel(uuid, uuid, text, uuid) to authenticated;
