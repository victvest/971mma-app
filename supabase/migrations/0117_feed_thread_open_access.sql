-- Align feed thread, comments, likes, and profile with open feed access (see 0113).

create or replace function public.feed_comment_as_json(
  p_comment_id uuid,
  p_viewer_id uuid default auth.uid()
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', fc.id,
    'postId', fc.post_id,
    'authorId', fc.author_id,
    'authorName', coalesce(nullif(trim(pr.full_name), ''), 'Member'),
    'authorAvatarUrl', pr.avatar_url,
    'authorRole', pr.role,
    'isVerifiedCoach', public.feed_is_verified_coach(fc.author_id),
    'body', fc.body,
    'canDelete', fc.author_id = p_viewer_id or public.is_admin(),
    'createdAt', fc.created_at
  )
  from public.feed_comments fc
  join public.feed_posts fp on fp.id = fc.post_id
  join public.profiles pr on pr.id = fc.author_id
  where fc.id = p_comment_id
    and fc.status = 'visible'
    and fc.deleted_at is null
    and fp.status = 'published'
    and fp.deleted_at is null;
$$;

create or replace function public.list_feed_comments(
  p_post_id uuid,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit int default 20,
  p_target_user_id uuid default null,
  p_author_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_actor uuid := public.feed_resolve_actor(p_target_user_id);
  v_post public.feed_posts%rowtype;
  v_limit int := greatest(least(coalesce(p_limit, 20), 50), 1);
  v_comments jsonb := '[]'::jsonb;
  v_count int := 0;
  v_next_created_at timestamptz;
  v_next_id uuid;
begin
  select * into v_post
  from public.feed_posts fp
  join public.disciplines d on d.id = fp.discipline_id
  where fp.id = p_post_id
    and fp.status = 'published'
    and fp.deleted_at is null
    and d.active = true;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if p_author_id is not null and v_post.author_id <> p_author_id then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if p_author_id is not null and v_actor <> v_viewer and p_author_id <> v_actor and not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(row_data order by created_at asc, id asc), '[]'::jsonb),
         count(*)
    into v_comments, v_count
  from (
    select
      fc.id,
      fc.created_at,
      public.feed_comment_as_json(fc.id, v_actor) as row_data
    from public.feed_comments fc
    where fc.post_id = p_post_id
      and fc.status = 'visible'
      and fc.deleted_at is null
      and (
        p_cursor_created_at is null
        or p_cursor_id is null
        or (fc.created_at, fc.id) > (p_cursor_created_at, p_cursor_id)
      )
    order by fc.created_at asc, fc.id asc
    limit v_limit
  ) rows;

  if v_count = v_limit then
    select fc.created_at, fc.id
      into v_next_created_at, v_next_id
    from public.feed_comments fc
    where fc.post_id = p_post_id
      and fc.status = 'visible'
      and fc.deleted_at is null
      and (
        p_cursor_created_at is null
        or p_cursor_id is null
        or (fc.created_at, fc.id) > (p_cursor_created_at, p_cursor_id)
      )
    order by fc.created_at asc, fc.id asc
    offset v_limit - 1
    limit 1;
  end if;

  return jsonb_build_object(
    'comments', v_comments,
    'nextCursor', case when v_count = v_limit then v_next_created_at else null end,
    'nextCursorId', case when v_count = v_limit then v_next_id else null end
  );
end;
$$;

create or replace function public.create_feed_comment(
  p_post_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_post public.feed_posts%rowtype;
  v_body text := trim(coalesce(p_body, ''));
  v_comment public.feed_comments%rowtype;
  v_actor_name text;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if char_length(v_body) = 0 or char_length(v_body) > 500 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select fp.* into v_post
  from public.feed_posts fp
  join public.disciplines d on d.id = fp.discipline_id
  where fp.id = p_post_id
    and fp.status = 'published'
    and fp.deleted_at is null
    and d.active = true;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  insert into public.feed_comments (post_id, author_id, body, status)
  values (p_post_id, v_user, v_body, 'visible')
  returning * into v_comment;

  if v_post.author_id <> v_user then
    select coalesce(nullif(trim(full_name), ''), 'Someone')
      into v_actor_name
    from public.profiles
    where id = v_user;

    insert into public.notifications (user_id, type, payload)
    select
      v_post.author_id,
      'feed_comment',
      jsonb_build_object(
        'title', 'New comment',
        'body', left(v_actor_name || ': ' || v_body, 180),
        'postId', p_post_id,
        'commentId', v_comment.id,
        'actorId', v_user,
        'url', '/feed/post/' || p_post_id::text
      )
    where coalesce(public.notification_enabled(v_post.author_id, 'feed_comment'), true);
  end if;

  return jsonb_build_object(
    'comment', public.feed_comment_as_json(v_comment.id, v_user),
    'post', public.feed_post_as_json(p_post_id, v_user)
  );
end;
$$;

create or replace function public.toggle_feed_like(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_post public.feed_posts%rowtype;
  v_removed boolean := false;
  v_actor_name text;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  select fp.* into v_post
  from public.feed_posts fp
  join public.disciplines d on d.id = fp.discipline_id
  where fp.id = p_post_id
    and fp.status = 'published'
    and fp.deleted_at is null
    and d.active = true;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  delete from public.feed_likes
  where post_id = p_post_id
    and user_id = v_user;

  if found then
    v_removed := true;
  else
    insert into public.feed_likes (post_id, user_id)
    values (p_post_id, v_user)
    on conflict do nothing;

    if v_post.author_id <> v_user then
      select coalesce(nullif(trim(full_name), ''), 'Someone')
        into v_actor_name
      from public.profiles
      where id = v_user;

      insert into public.notifications (user_id, type, payload)
      select
        v_post.author_id,
        'feed_like',
        jsonb_build_object(
          'title', 'New like',
          'body', v_actor_name || ' liked your post.',
          'postId', p_post_id,
          'actorId', v_user,
          'url', '/feed/post/' || p_post_id::text
        )
      where coalesce(public.notification_enabled(v_post.author_id, 'feed_like'), true);
    end if;
  end if;

  return public.feed_post_as_json(p_post_id, v_user)
    || jsonb_build_object('likeToggled', jsonb_build_object('removed', v_removed));
end;
$$;

create or replace function public.record_feed_share(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_post public.feed_posts%rowtype;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  select fp.* into v_post
  from public.feed_posts fp
  join public.disciplines d on d.id = fp.discipline_id
  where fp.id = p_post_id
    and fp.status = 'published'
    and fp.deleted_at is null
    and d.active = true;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  update public.feed_posts
  set share_count = share_count + 1,
      updated_at = now()
  where id = p_post_id;

  return public.feed_post_as_json(p_post_id, v_user);
end;
$$;

create or replace function public.get_feed_profile(
  p_user_id uuid,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit int default 12,
  p_target_user_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.feed_resolve_actor(p_target_user_id);
  v_profile jsonb;
  v_posts jsonb := '[]'::jsonb;
  v_count int := 0;
  v_limit int := greatest(least(coalesce(p_limit, 12), 30), 1);
  v_next_published_at timestamptz;
  v_next_id uuid;
begin
  select jsonb_build_object(
    'id', p.id,
    'name', coalesce(nullif(trim(p.full_name), ''), 'Member'),
    'avatarUrl', p.avatar_url,
    'bio', p.bio,
    'role', p.role,
    'isVerifiedCoach', public.feed_is_verified_coach(p.id),
    'beltRank', coalesce(rank_progress.name, p.belt_rank),
    'beltStripes', coalesce(rank_progress.stripe, p.belt_stripes, 0),
    'primaryDiscipline', rank_progress.discipline_name,
    'memberSince', p.member_since,
    'postCount', (
      select count(*)::int
      from public.feed_posts fp
      join public.disciplines d on d.id = fp.discipline_id
      where fp.author_id = p.id
        and fp.status = 'published'
        and fp.deleted_at is null
        and d.active = true
    ),
    'followerCount', (
      select count(*)::int
      from public.feed_profile_follows f
      where f.followee_id = p.id
    ),
    'isFollowing', exists (
      select 1
      from public.feed_profile_follows f
      where f.followee_id = p.id
        and f.follower_id = v_actor
    )
  )
  into v_profile
  from public.profiles p
  left join lateral (
    select mrp.stripe, rl.name, d.display_name as discipline_name
    from public.member_rank_progress mrp
    join public.rank_levels rl on rl.id = mrp.rank_level_id
    join public.disciplines d on d.id = mrp.discipline_id
    where mrp.user_id = p.id
    order by case when d.slug = 'bjj' then 1 else 2 end
    limit 1
  ) rank_progress on true
  where p.id = p_user_id;

  if v_profile is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(row_data order by published_at desc, id desc), '[]'::jsonb),
         count(*)
    into v_posts, v_count
  from (
    select
      fp.id,
      fp.published_at,
      public.feed_post_as_json(fp.id, v_actor) as row_data
    from public.feed_posts fp
    join public.disciplines d on d.id = fp.discipline_id
    where fp.author_id = p_user_id
      and fp.status = 'published'
      and fp.deleted_at is null
      and d.active = true
      and (
        p_cursor_published_at is null
        or p_cursor_id is null
        or (fp.published_at, fp.id) < (p_cursor_published_at, p_cursor_id)
      )
    order by fp.published_at desc, fp.id desc
    limit v_limit
  ) rows;

  if v_count = v_limit then
    select fp.published_at, fp.id
      into v_next_published_at, v_next_id
    from public.feed_posts fp
    join public.disciplines d on d.id = fp.discipline_id
    where fp.author_id = p_user_id
      and fp.status = 'published'
      and fp.deleted_at is null
      and d.active = true
      and (
        p_cursor_published_at is null
        or p_cursor_id is null
        or (fp.published_at, fp.id) < (p_cursor_published_at, p_cursor_id)
      )
    order by fp.published_at desc, fp.id desc
    offset v_limit - 1
    limit 1;
  end if;

  return jsonb_build_object(
    'profile', v_profile,
    'posts', v_posts,
    'nextCursor', case when v_count = v_limit then v_next_published_at else null end,
    'nextCursorId', case when v_count = v_limit then v_next_id else null end
  );
end;
$$;
