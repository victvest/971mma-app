-- Allow coach community RPCs to resolve the coach by explicit id (name-matched mobile profile)
-- instead of requiring coaches.user_id linkage.

create or replace function public.list_coach_community_channels(p_coach_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := coalesce(p_coach_id, public.coach_id_for_user());
  v_channels jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
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
    'Coach updates and discussion for ' || d.display_name || ' members.',
    'active'
  from public.coach_disciplines cd
  join public.coaches co on co.id = cd.coach_id
  join public.disciplines d on d.id = cd.discipline_id
  where cd.coach_id = v_coach_id
  on conflict (coach_id, discipline_id) do nothing;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ch.id,
        'title', ch.title,
        'description', ch.description,
        'disciplineName', d.display_name,
        'disciplineSlug', d.slug,
        'coachName', co.name,
        'status', ch.status
      )
      order by d.sort_order asc, ch.title asc
    ),
    '[]'::jsonb
  )
  into v_channels
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  join public.disciplines d on d.id = ch.discipline_id
  join public.coach_disciplines cd on cd.coach_id = ch.coach_id and cd.discipline_id = ch.discipline_id
  where ch.coach_id = v_coach_id
    and ch.deleted_at is null;

  return jsonb_build_object('channels', v_channels);
end;
$$;

create or replace function public.publish_community_post(
  p_channel_id uuid,
  p_title text default null,
  p_body text default null,
  p_coach_id uuid default null
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

  insert into public.community_posts (
    channel_id,
    author_id,
    title,
    body,
    status,
    published_at
  )
  values (
    v_channel.id,
    v_user,
    v_title,
    v_body,
    'published',
    now()
  )
  returning * into v_post;

  insert into public.notifications (user_id, type, payload)
  select
    cm.user_id,
    'community',
    jsonb_build_object(
      'title', coalesce(v_title, 'New coach post'),
      'body', left(v_body, 180),
      'channelId', v_channel.id,
      'postId', v_post.id,
      'url', '/communities/' || v_channel.id::text || '/posts/' || v_post.id::text
    )
  from public.community_memberships cm
  where cm.channel_id = v_channel.id
    and cm.user_id <> v_user
    and cm.joined_at is not null
    and cm.muted_at is null
    and coalesce(public.notification_enabled(cm.user_id, 'community'), true);

  return v_post;
end;
$$;

revoke execute on function public.list_coach_community_channels(uuid) from public, anon;
grant execute on function public.list_coach_community_channels(uuid) to authenticated;

revoke execute on function public.publish_community_post(uuid, text, text, uuid) from public, anon;
grant execute on function public.publish_community_post(uuid, text, text, uuid) to authenticated;
