-- Phase 1: Community group chat — announcement kinds, pinning, read state, feed RPCs.

alter table public.community_posts
  add column if not exists post_kind text not null default 'announcement'
    check (post_kind in ('announcement', 'system'));

alter table public.community_posts
  add column if not exists is_pinned boolean not null default false;

alter table public.community_posts
  add column if not exists pinned_at timestamptz;

alter table public.community_memberships
  add column if not exists last_read_at timestamptz;

create index if not exists idx_community_posts_channel_feed
  on public.community_posts (channel_id, is_pinned desc, published_at desc)
  where status = 'published' and deleted_at is null;

create unique index if not exists idx_community_posts_one_pinned_per_channel
  on public.community_posts (channel_id)
  where is_pinned = true and status = 'published' and deleted_at is null;

-- Shared JSON builder for community post payloads.
create or replace function public.community_post_as_json(
  p_post_id uuid,
  p_viewer_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', cp.id,
    'channelId', cp.channel_id,
    'authorId', cp.author_id,
    'authorName', coalesce(pr.full_name, 'Coach'),
    'authorAvatarUrl', pr.avatar_url,
    'authorRole', case when cp.author_id = co.user_id then 'coach' else 'member' end,
    'title', cp.title,
    'body', cp.body,
    'mediaUrl', cp.media_url,
    'postKind', cp.post_kind,
    'isPinned', cp.is_pinned,
    'pinnedAt', cp.pinned_at,
    'publishedAt', cp.published_at,
    'reactionCounts', coalesce(reactions.counts, '{}'::jsonb),
    'replyCount', coalesce(replies.cnt, 0),
    'myReactions', coalesce(reactions.mine, '[]'::jsonb)
  )
  from public.community_posts cp
  join public.profiles pr on pr.id = cp.author_id
  join public.community_channels ch on ch.id = cp.channel_id
  join public.coaches co on co.id = ch.coach_id
  left join lateral (
    select
      coalesce(jsonb_object_agg(r.emoji, r.cnt) filter (where r.emoji is not null), '{}'::jsonb) as counts,
      coalesce(jsonb_agg(r.emoji) filter (where r.mine), '[]'::jsonb) as mine
    from (
      select
        cr.emoji,
        count(*)::int as cnt,
        bool_or(cr.user_id = p_viewer_id) as mine
      from public.community_reactions cr
      where cr.post_id = cp.id
      group by cr.emoji
    ) r
  ) reactions on true
  left join lateral (
    select count(*)::int as cnt
    from public.community_replies cr
    where cr.post_id = cp.id
      and cr.status = 'visible'
      and cr.deleted_at is null
  ) replies on true
  where cp.id = p_post_id
    and cp.status = 'published'
    and cp.deleted_at is null;
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
        'isCoachOwner', co.user_id = v_user
      )
      order by coalesce(latest.published_at, ch.created_at) desc
    ),
    '[]'::jsonb
  )
  into v_channels
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  join public.disciplines d on d.id = ch.discipline_id
  left join public.profiles p on p.id = co.user_id
  join public.community_memberships cm on cm.channel_id = ch.id and cm.user_id = v_user and cm.joined_at is not null
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
  where ch.status = 'active'
    and ch.deleted_at is null;

  return jsonb_build_object('channels', v_channels);
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

  select jsonb_build_object(
    'id', ch.id,
    'title', ch.title,
    'description', ch.description,
    'disciplineName', d.display_name,
    'disciplineSlug', d.slug,
    'coachId', co.id,
    'coachName', co.name,
    'coachAvatarUrl', p.avatar_url,
    'memberCount', member_counts.cnt,
    'isCoachOwner', co.user_id = v_user,
    'pinnedPost', case
      when v_pinned is null then null
      else public.community_post_as_json(v_pinned, v_user)
    end
  )
  into v_header
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  join public.disciplines d on d.id = ch.discipline_id
  left join public.profiles p on p.id = co.user_id
  left join lateral (
    select count(*)::int as cnt
    from public.community_memberships cm2
    where cm2.channel_id = ch.id
      and cm2.joined_at is not null
  ) member_counts on true
  where ch.id = p_channel_id
    and ch.deleted_at is null;

  if v_header is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  return v_header;
end;
$$;

create or replace function public.list_community_channel_feed(
  p_channel_id uuid,
  p_limit int default 25,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_pinned uuid;
  v_posts jsonb := '[]'::jsonb;
  v_next_published_at timestamptz;
  v_next_id uuid;
  v_limit int := greatest(least(coalesce(p_limit, 25), 50), 1);
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

  select coalesce(
    jsonb_agg(row_data order by row_data->>'publishedAt' desc),
    '[]'::jsonb
  )
  into v_posts
  from (
    select public.community_post_as_json(cp.id, v_user) as row_data,
           cp.published_at,
           cp.id
    from public.community_posts cp
    where cp.channel_id = p_channel_id
      and cp.status = 'published'
      and cp.deleted_at is null
      and (v_pinned is null or cp.id <> v_pinned)
      and (
        p_cursor_published_at is null
        or p_cursor_id is null
        or (cp.published_at, cp.id) < (p_cursor_published_at, p_cursor_id)
      )
    order by cp.published_at desc, cp.id desc
    limit v_limit + 1
  ) rows;

  if jsonb_array_length(v_posts) > v_limit then
    select (v_posts->(v_limit - 1)->>'publishedAt')::timestamptz,
           (v_posts->(v_limit - 1)->>'id')::uuid
      into v_next_published_at, v_next_id;

    v_posts := (
      select coalesce(jsonb_agg(value order by (value->>'publishedAt') desc), '[]'::jsonb)
      from jsonb_array_elements(v_posts) with ordinality as t(value, ord)
      where ord <= v_limit
    );
  else
    v_next_published_at := null;
    v_next_id := null;
  end if;

  return jsonb_build_object(
    'pinnedPost', case
      when v_pinned is null then null
      else public.community_post_as_json(v_pinned, v_user)
    end,
    'posts', v_posts,
    'nextCursor', case
      when v_next_published_at is null or v_next_id is null then null
      else jsonb_build_object('publishedAt', v_next_published_at, 'id', v_next_id)
    end
  );
end;
$$;

create or replace function public.list_community_channel_posts(
  p_channel_id uuid,
  p_limit int default 20,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_posts jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if not public.can_access_community_channel(p_channel_id, v_user) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select coalesce(
    jsonb_agg(row_data order by row_data->>'publishedAt' desc),
    '[]'::jsonb
  )
  into v_posts
  from (
    select public.community_post_as_json(cp.id, v_user) as row_data,
           cp.published_at
    from public.community_posts cp
    where cp.channel_id = p_channel_id
      and cp.status = 'published'
      and cp.deleted_at is null
    order by cp.published_at desc
    limit greatest(p_limit, 1)
    offset greatest(p_offset, 0)
  ) rows;

  return jsonb_build_object('posts', v_posts);
end;
$$;

create or replace function public.get_community_post_thread(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_post jsonb;
  v_replies jsonb := '[]'::jsonb;
  v_channel_id uuid;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  select cp.channel_id
    into v_channel_id
  from public.community_posts cp
  where cp.id = p_post_id
    and cp.status = 'published'
    and cp.deleted_at is null;

  if v_channel_id is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if not public.can_access_community_channel(v_channel_id, v_user) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  v_post := public.community_post_as_json(p_post_id, v_user);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cr.id,
        'postId', cr.post_id,
        'userId', cr.user_id,
        'authorName', coalesce(pr.full_name, 'Member'),
        'authorAvatarUrl', pr.avatar_url,
        'body', cr.body,
        'createdAt', cr.created_at
      )
      order by cr.created_at asc
    ),
    '[]'::jsonb
  )
  into v_replies
  from public.community_replies cr
  join public.profiles pr on pr.id = cr.user_id
  where cr.post_id = p_post_id
    and cr.status = 'visible'
    and cr.deleted_at is null;

  return jsonb_build_object('post', v_post, 'replies', v_replies);
end;
$$;

create or replace function public.mark_community_channel_read(p_channel_id uuid)
returns public.community_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.community_memberships%rowtype;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if not public.can_access_community_channel(p_channel_id, v_user) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  update public.community_memberships
  set last_read_at = now(),
      updated_at = now()
  where channel_id = p_channel_id
    and user_id = v_user
    and joined_at is not null
  returning * into v_row;

  if v_row.id is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

create or replace function public._community_unpin_channel_posts(p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_posts
  set is_pinned = false,
      pinned_at = null,
      updated_at = now()
  where channel_id = p_channel_id
    and is_pinned = true
    and status = 'published'
    and deleted_at is null;
end;
$$;

create or replace function public.pin_community_post(
  p_post_id uuid,
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
  v_post public.community_posts%rowtype;
  v_channel public.community_channels%rowtype;
begin
  if v_user is null or v_coach_id is null then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select * into v_post
  from public.community_posts
  where id = p_post_id
    and status = 'published'
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select * into v_channel
  from public.community_channels
  where id = v_post.channel_id
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_channel.coach_id <> v_coach_id then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  perform public._community_unpin_channel_posts(v_channel.id);

  update public.community_posts
  set is_pinned = true,
      pinned_at = now(),
      updated_at = now()
  where id = p_post_id
  returning * into v_post;

  return v_post;
end;
$$;

create or replace function public.unpin_community_post(
  p_post_id uuid,
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
  v_post public.community_posts%rowtype;
  v_channel public.community_channels%rowtype;
begin
  if v_user is null or v_coach_id is null then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select * into v_post
  from public.community_posts
  where id = p_post_id
    and status = 'published'
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select * into v_channel
  from public.community_channels
  where id = v_post.channel_id
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_channel.coach_id <> v_coach_id then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  update public.community_posts
  set is_pinned = false,
      pinned_at = null,
      updated_at = now()
  where id = p_post_id
  returning * into v_post;

  return v_post;
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

revoke execute on function public.community_post_as_json(uuid, uuid) from public, anon;
grant execute on function public.community_post_as_json(uuid, uuid) to authenticated;

revoke execute on function public.get_community_channel_header(uuid) from public, anon;
grant execute on function public.get_community_channel_header(uuid) to authenticated;

revoke execute on function public.list_community_channel_feed(uuid, int, timestamptz, uuid) from public, anon;
grant execute on function public.list_community_channel_feed(uuid, int, timestamptz, uuid) to authenticated;

revoke execute on function public.mark_community_channel_read(uuid) from public, anon;
grant execute on function public.mark_community_channel_read(uuid) to authenticated;

revoke execute on function public.pin_community_post(uuid, uuid) from public, anon;
grant execute on function public.pin_community_post(uuid, uuid) to authenticated;

revoke execute on function public.unpin_community_post(uuid, uuid) from public, anon;
grant execute on function public.unpin_community_post(uuid, uuid) to authenticated;

revoke execute on function public._community_unpin_channel_posts(uuid) from public, anon;

revoke execute on function public.publish_community_post(uuid, text, text, uuid) from public, anon;
revoke execute on function public.publish_community_post(uuid, text, text, uuid, text, boolean) from public, anon;
grant execute on function public.publish_community_post(uuid, text, text, uuid, text, boolean) to authenticated;
