-- Guardian child profile feed boundaries.
--
-- Parents acting through a linked child profile should see and manage only that
-- child's posts. These overloads keep the existing feed RPCs intact for older
-- clients while allowing the app to pass p_target_user_id for guardian context.

create or replace function public.feed_resolve_actor(p_target_user_id uuid default null)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if p_target_user_id is null or p_target_user_id = v_viewer then
    return v_viewer;
  end if;

  if public.is_admin() or public.is_approved_guardian_of(p_target_user_id) then
    return p_target_user_id;
  end if;

  raise exception using message = 'FORBIDDEN', errcode = 'P0001';
end;
$$;

create or replace function public.list_feed_disciplines(p_target_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.feed_resolve_actor(p_target_user_id);
  v_disciplines jsonb := '[]'::jsonb;
begin
  select jsonb_build_object(
    'disciplines',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'slug', slug,
          'displayName', display_name,
          'hasRankProgression', has_rank_progression,
          'isMemberDiscipline', is_member_discipline
        )
        order by sort_order asc, display_name asc
      ),
      '[]'::jsonb
    )
  )
  into v_disciplines
  from public.feed_accessible_disciplines(v_actor);

  return v_disciplines;
end;
$$;

create or replace function public.list_feed_posts(
  p_discipline_id uuid default null,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit int default 12,
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
  v_limit int := greatest(least(coalesce(p_limit, 12), 30), 1);
  v_posts jsonb := '[]'::jsonb;
  v_count int := 0;
  v_next_published_at timestamptz;
  v_next_id uuid;
  v_disciplines jsonb := '[]'::jsonb;
begin
  if p_discipline_id is not null and not public.can_access_feed_discipline(v_actor, p_discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if p_author_id is not null and v_actor <> v_viewer and p_author_id <> v_actor and not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
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
    where fp.status = 'published'
      and fp.deleted_at is null
      and (p_author_id is null or fp.author_id = p_author_id)
      and (p_discipline_id is null or fp.discipline_id = p_discipline_id)
      and public.can_access_feed_discipline(v_actor, fp.discipline_id)
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
    where fp.status = 'published'
      and fp.deleted_at is null
      and (p_author_id is null or fp.author_id = p_author_id)
      and (p_discipline_id is null or fp.discipline_id = p_discipline_id)
      and public.can_access_feed_discipline(v_actor, fp.discipline_id)
      and (
        p_cursor_published_at is null
        or p_cursor_id is null
        or (fp.published_at, fp.id) < (p_cursor_published_at, p_cursor_id)
      )
    order by fp.published_at desc, fp.id desc
    offset v_limit - 1
    limit 1;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'slug', slug,
        'displayName', display_name,
        'hasRankProgression', has_rank_progression,
        'isMemberDiscipline', is_member_discipline
      )
      order by sort_order asc, display_name asc
    ),
    '[]'::jsonb
  )
  into v_disciplines
  from public.feed_accessible_disciplines(v_actor);

  return jsonb_build_object(
    'posts', v_posts,
    'disciplines', v_disciplines,
    'nextCursor', case when v_count = v_limit then v_next_published_at else null end,
    'nextCursorId', case when v_count = v_limit then v_next_id else null end
  );
end;
$$;

create or replace function public.create_feed_post(
  p_discipline_id uuid,
  p_body text,
  p_media jsonb default '[]'::jsonb,
  p_target_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.feed_resolve_actor(p_target_user_id);
  v_body text := trim(coalesce(p_body, ''));
  v_media jsonb := coalesce(p_media, '[]'::jsonb);
  v_post public.feed_posts%rowtype;
begin
  if p_discipline_id is null or not public.can_access_feed_discipline(v_actor, p_discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if char_length(v_body) = 0 or char_length(v_body) > 1000 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if jsonb_typeof(v_media) <> 'array' or jsonb_array_length(v_media) > 4 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  insert into public.feed_posts (author_id, discipline_id, body, media, status, published_at)
  values (v_actor, p_discipline_id, v_body, v_media, 'published', now())
  returning * into v_post;

  return public.feed_post_as_json(v_post.id, v_actor);
end;
$$;

create or replace function public.delete_own_feed_post(
  p_post_id uuid,
  p_target_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.feed_resolve_actor(p_target_user_id);
begin
  update public.feed_posts
  set status = 'deleted',
      deleted_at = now(),
      updated_at = now()
  where id = p_post_id
    and author_id = v_actor
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true, 'postId', p_post_id);
end;
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
  from public.feed_posts
  where id = p_post_id
    and status = 'published'
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if p_author_id is not null and v_post.author_id <> p_author_id then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if p_author_id is not null and v_actor <> v_viewer and p_author_id <> v_actor and not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.can_access_feed_discipline(v_actor, v_post.discipline_id) then
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

create or replace function public.get_feed_post_thread(
  p_post_id uuid,
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
  v_actor uuid := public.feed_resolve_actor(p_target_user_id);
  v_post jsonb;
  v_comments jsonb;
begin
  v_post := public.feed_post_as_json(p_post_id, v_actor);
  if v_post is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if p_author_id is not null and coalesce(v_post ->> 'authorId', '') <> p_author_id::text then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  v_comments := public.list_feed_comments(
    p_post_id,
    null,
    null,
    20,
    p_target_user_id,
    p_author_id
  );

  return jsonb_build_object(
    'post', v_post,
    'comments', coalesce(v_comments -> 'comments', '[]'::jsonb),
    'nextCursor', v_comments -> 'nextCursor',
    'nextCursorId', v_comments -> 'nextCursorId'
  );
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
      where fp.author_id = p.id
        and fp.status = 'published'
        and fp.deleted_at is null
        and public.can_access_feed_discipline(v_actor, fp.discipline_id)
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
    where fp.author_id = p_user_id
      and fp.status = 'published'
      and fp.deleted_at is null
      and public.can_access_feed_discipline(v_actor, fp.discipline_id)
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
    where fp.author_id = p_user_id
      and fp.status = 'published'
      and fp.deleted_at is null
      and public.can_access_feed_discipline(v_actor, fp.discipline_id)
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

grant execute on function public.feed_resolve_actor(uuid) to authenticated;
grant execute on function public.list_feed_disciplines(uuid) to authenticated;
grant execute on function public.list_feed_posts(uuid, timestamptz, uuid, int, uuid, uuid) to authenticated;
grant execute on function public.create_feed_post(uuid, text, jsonb, uuid) to authenticated;
grant execute on function public.delete_own_feed_post(uuid, uuid) to authenticated;
grant execute on function public.list_feed_comments(uuid, timestamptz, uuid, int, uuid, uuid) to authenticated;
grant execute on function public.get_feed_post_thread(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_feed_profile(uuid, timestamptz, uuid, int, uuid) to authenticated;
