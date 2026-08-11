-- Show every active academy discipline in feed pickers; allow posting to any of them.
-- Member-specific entitlements still drive belt path / communities — not feed category selection.

create or replace function public.feed_discipline_catalog(p_user uuid default auth.uid())
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'slug', d.slug,
        'displayName', d.display_name,
        'hasRankProgression', d.has_rank_progression,
        'isMemberDiscipline', exists (
          select 1
          from public.member_disciplines md
          where md.user_id = p_user
            and md.discipline_id = d.id
            and md.active = true
            and (md.ends_on is null or md.ends_on >= current_date)
        )
      )
      order by d.sort_order asc, d.display_name asc
    ),
    '[]'::jsonb
  )
  from public.disciplines d
  where d.active = true;
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
begin
  return jsonb_build_object('disciplines', public.feed_discipline_catalog(v_actor));
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
  if p_discipline_id is not null and not exists (
    select 1
    from public.disciplines d
    where d.id = p_discipline_id
      and d.active = true
  ) then
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
      and (p_discipline_id is null or fp.discipline_id = p_discipline_id)
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
      and (p_discipline_id is null or fp.discipline_id = p_discipline_id)
      and (
        p_cursor_published_at is null
        or p_cursor_id is null
        or (fp.published_at, fp.id) < (p_cursor_published_at, p_cursor_id)
      )
    order by fp.published_at desc, fp.id desc
    offset v_limit - 1
    limit 1;
  end if;

  v_disciplines := public.feed_discipline_catalog(v_actor);

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
  if p_discipline_id is null or not exists (
    select 1
    from public.disciplines d
    where d.id = p_discipline_id
      and d.active = true
  ) then
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

create or replace function public.feed_post_as_json(
  p_post_id uuid,
  p_viewer_id uuid default auth.uid()
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', fp.id,
    'authorId', fp.author_id,
    'authorName', coalesce(nullif(trim(pr.full_name), ''), 'Member'),
    'authorAvatarUrl', pr.avatar_url,
    'authorBio', pr.bio,
    'authorRole', pr.role,
    'isVerifiedCoach', public.feed_is_verified_coach(fp.author_id),
    'disciplineId', fp.discipline_id,
    'disciplineName', d.display_name,
    'disciplineSlug', d.slug,
    'body', fp.body,
    'media', fp.media,
    'likeCount', fp.like_count,
    'commentCount', fp.comment_count,
    'shareCount', fp.share_count,
    'myLiked', exists (
      select 1
      from public.feed_likes fl
      where fl.post_id = fp.id
        and fl.user_id = p_viewer_id
    ),
    'canDelete', fp.author_id = p_viewer_id or public.is_admin(),
    'publishedAt', fp.published_at,
    'createdAt', fp.created_at
  )
  from public.feed_posts fp
  join public.profiles pr on pr.id = fp.author_id
  join public.disciplines d on d.id = fp.discipline_id
  where fp.id = p_post_id
    and fp.status = 'published'
    and fp.deleted_at is null;
$$;

revoke execute on function public.feed_discipline_catalog(uuid) from public, anon;
grant execute on function public.feed_discipline_catalog(uuid) to authenticated;
