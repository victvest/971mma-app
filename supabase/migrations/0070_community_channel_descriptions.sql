-- Stop seeding boilerplate channel descriptions.

update public.community_channels
set description = null,
    updated_at = now()
where description ilike 'Coach updates and discussion for %';

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
  select * into v_coach from public.coaches where id = p_coach_id and deleted_at is null;
  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select * into v_discipline from public.disciplines where id = p_discipline_id and active = true;
  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  insert into public.community_channels (coach_id, discipline_id, title, description, status)
  values (
    p_coach_id,
    p_discipline_id,
    v_coach.name || ' · ' || v_discipline.display_name,
    null,
    'active'
  )
  on conflict (coach_id, discipline_id) do update
  set title = excluded.title,
      description = null,
      updated_at = now(),
      status = case when public.community_channels.status = 'archived' then 'active' else public.community_channels.status end
  returning * into v_row;

  return v_row;
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

  insert into public.community_channels (coach_id, discipline_id, title, description, status)
  select
    cd.coach_id,
    cd.discipline_id,
    co.name || ' · ' || d.display_name,
    null,
    'active'
  from public.coach_disciplines cd
  join public.coaches co on co.id = cd.coach_id
  join public.disciplines d on d.id = cd.discipline_id
  where cd.coach_id = v_coach_id
  on conflict (coach_id, discipline_id) do nothing;

  perform public.sync_community_memberships(v_user);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ch.id,
        'title', ch.title,
        'description', ch.description,
        'disciplineName', d.display_name,
        'disciplineSlug', d.slug,
        'coachName', co.name,
        'coachAvatarUrl', p.avatar_url,
        'latestPostAt', latest.published_at,
        'lastMessageAt', latest.published_at,
        'lastMessagePreview', latest.preview,
        'unreadCount', coalesce(unread.cnt, 0),
        'memberCount', member_counts.cnt,
        'isCoachOwner', true
      )
      order by coalesce(latest.published_at, ch.created_at) desc, d.sort_order asc
    ),
    '[]'::jsonb
  )
  into v_channels
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  join public.disciplines d on d.id = ch.discipline_id
  join public.coach_disciplines cd on cd.coach_id = ch.coach_id and cd.discipline_id = ch.discipline_id
  left join public.profiles p on p.id = co.user_id
  left join public.community_memberships cm
    on cm.channel_id = ch.id
   and cm.user_id = v_user
   and cm.joined_at is not null
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
  where ch.coach_id = v_coach_id
    and ch.deleted_at is null;

  return jsonb_build_object('channels', v_channels);
end;
$$;

grant execute on function public.list_coach_community_channels(uuid) to authenticated;
