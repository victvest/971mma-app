-- Phase 11 group chat polish: admin moderation metadata + notification payload postKind.

drop function if exists public.admin_list_community_moderation(int, int);

create or replace function public.admin_list_community_moderation(
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  target_type text,
  target_id uuid,
  channel_id uuid,
  channel_title text,
  preview text,
  status text,
  author_name text,
  created_at timestamptz,
  post_kind text,
  is_pinned boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  (
    select
      'post'::text,
      cp.id,
      cp.channel_id,
      ch.title,
      left(coalesce(cp.title, cp.body), 160),
      cp.status,
      coalesce(pr.full_name, 'Coach'),
      cp.published_at,
      cp.post_kind,
      cp.is_pinned
    from public.community_posts cp
    join public.community_channels ch on ch.id = cp.channel_id
    join public.profiles pr on pr.id = cp.author_id
    where cp.deleted_at is null
      and cp.status in ('published', 'hidden')
  )
  union all
  (
    select
      'reply'::text,
      cr.id,
      cp.channel_id,
      ch.title,
      left(cr.body, 160),
      cr.status,
      coalesce(pr.full_name, 'Member'),
      cr.created_at,
      null::text,
      false
    from public.community_replies cr
    join public.community_posts cp on cp.id = cr.post_id
    join public.community_channels ch on ch.id = cp.channel_id
    join public.profiles pr on pr.id = cr.user_id
    where cr.deleted_at is null
      and cr.status in ('visible', 'hidden')
  )
  order by created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.admin_list_community_moderation(int, int) to authenticated;

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
    and coalesce(public.notification_enabled(cm.user_id, 'community'), true);

  return v_post;
end;
$$;

revoke execute on function public.publish_community_post(uuid, text, text, uuid) from public, anon;
revoke execute on function public.publish_community_post(uuid, text, text, uuid, text, boolean) from public, anon;
grant execute on function public.publish_community_post(uuid, text, text, uuid, text, boolean) to authenticated;
