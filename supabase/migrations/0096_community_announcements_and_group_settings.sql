-- Phase 11 refinement: separate discipline-wide community announcements from group chats.

alter table public.community_channels
  add column if not exists channel_kind text not null default 'group';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_channels_channel_kind_check'
      and conrelid = 'public.community_channels'::regclass
  ) then
    alter table public.community_channels
      add constraint community_channels_channel_kind_check
      check (channel_kind in ('community', 'group'));
  end if;
end $$;

create unique index if not exists idx_community_channels_unique_community
  on public.community_channels (coach_id, discipline_id)
  where channel_kind = 'community' and deleted_at is null;

create index if not exists idx_community_channels_kind_coach
  on public.community_channels (channel_kind, coach_id, status, created_at desc)
  where deleted_at is null;

create index if not exists idx_community_channels_kind_discipline
  on public.community_channels (channel_kind, discipline_id, status, created_at desc)
  where deleted_at is null;

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
          ch.channel_kind = 'community'
          and public.has_valid_academy_membership(p_user_id)
          and public.member_can_discover_discipline(p_user_id, ch.discipline_id)
        )
        or (
          ch.channel_kind = 'group'
          and public.has_valid_academy_membership(p_user_id)
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
        ch.channel_kind = 'community'
        and public.has_valid_academy_membership(p_user)
        and public.member_can_discover_discipline(p_user, ch.discipline_id)
      )
      or (
        ch.channel_kind = 'group'
        and public.has_valid_academy_membership(p_user)
        and exists (
          select 1
          from public.community_memberships cm
          where cm.channel_id = ch.id
            and cm.user_id = p_user
            and cm.joined_at is not null
        )
      )
      or (
        ch.channel_kind = 'group'
        and ch.visibility = 'public'
        and public.member_can_discover_discipline(p_user, ch.discipline_id)
      )
    );
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
    and channel_kind = 'community'
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
      channel_kind,
      status
    )
    values (
      p_coach_id,
      p_discipline_id,
      v_discipline.display_name || ' community',
      'Announcements for all eligible ' || v_discipline.display_name || ' members.',
      'public',
      'community',
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

  insert into public.community_memberships (channel_id, user_id, invited_at, joined_at)
  select ch.id, v_user, now(), now()
  from public.community_channels ch
  where ch.channel_kind = 'community'
    and ch.status = 'active'
    and ch.deleted_at is null
    and public.has_valid_academy_membership(v_user)
    and public.member_can_discover_discipline(v_user, ch.discipline_id)
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      muted_at = null,
      updated_at = now();

  get diagnostics v_count = row_count;
  v_changed := v_changed + v_count;

  update public.community_memberships cm
  set joined_at = null,
      updated_at = now()
  from public.community_channels ch
  where ch.id = cm.channel_id
    and cm.user_id = v_user
    and cm.joined_at is not null
    and not exists (
      select 1
      from public.coaches co
      where co.id = ch.coach_id
        and co.user_id = v_user
        and co.active = true
        and co.deleted_at is null
    )
    and (
      ch.status <> 'active'
      or ch.deleted_at is not null
      or not public.has_valid_academy_membership(v_user)
      or (
        ch.channel_kind = 'community'
        and not public.member_can_discover_discipline(v_user, ch.discipline_id)
      )
    );

  get diagnostics v_count = row_count;
  v_changed := v_changed + v_count;

  return v_changed;
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
    'channelKind', ch.channel_kind,
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
    'canJoin', ch.channel_kind = 'group'
      and ch.visibility = 'public'
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
      order by
        case when ch.channel_kind = 'community' then 0 else 1 end,
        coalesce(latest.published_at, cm.joined_at, ch.created_at) desc
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
  where ch.channel_kind = 'group'
    and ch.status = 'active'
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

  if v_channel.channel_kind <> 'group' or v_channel.visibility <> 'public' then
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
  v_channel public.community_channels%rowtype;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  select * into v_channel
  from public.community_channels
  where id = p_channel_id
    and deleted_at is null;

  if not found then
    return;
  end if;

  if v_channel.channel_kind <> 'group' then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.coaches ch_coach
    where ch_coach.id = v_channel.coach_id
      and ch_coach.user_id = v_user
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

  perform public.sync_community_memberships(v_user);

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
    and ch.channel_kind = 'group'
    and ch.status = 'active'
    and ch.deleted_at is null;

  return jsonb_build_object('channels', v_channels);
end;
$$;

create or replace function public.list_coach_community_announcement_channels(
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
  v_channels jsonb := '[]'::jsonb;
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

  perform public.ensure_coach_community_channel(v_coach_id, d.id)
  from public.disciplines d
  where d.active = true
    and (
      exists (
        select 1
        from public.coach_disciplines cd
        where cd.coach_id = v_coach_id
          and cd.discipline_id = d.id
      )
      or not exists (
        select 1
        from public.coach_disciplines cd_any
        where cd_any.coach_id = v_coach_id
      )
    );

  perform public.sync_community_memberships(v_user);

  select coalesce(
    jsonb_agg(
      public.community_channel_summary_json(ch.id, v_user)
      order by d.sort_order asc, d.display_name asc
    ),
    '[]'::jsonb
  )
  into v_channels
  from public.community_channels ch
  join public.disciplines d on d.id = ch.discipline_id
  where ch.coach_id = v_coach_id
    and ch.channel_kind = 'community'
    and ch.status = 'active'
    and ch.deleted_at is null;

  return jsonb_build_object('channels', v_channels);
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
    and channel_kind = 'group'
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

revoke all on function public.list_coach_community_announcement_channels(uuid) from public, anon;
grant execute on function public.list_coach_community_announcement_channels(uuid) to authenticated;
