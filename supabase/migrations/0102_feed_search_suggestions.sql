-- Intelligent feed search suggestions when query is empty or too short.

create or replace function public.search_feed(
  p_query text,
  p_type text default 'all',
  p_limit int default 20,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_query text := trim(coalesce(p_query, ''));
  v_type text := lower(trim(coalesce(p_type, 'all')));
  v_limit int := greatest(least(coalesce(p_limit, 20), 40), 1);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_users jsonb := '[]'::jsonb;
  v_posts jsonb := '[]'::jsonb;
  v_user_count int := 0;
  v_post_count int := 0;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if v_type not in ('all', 'users', 'posts') then
    v_type := 'all';
  end if;

  if char_length(v_query) < 2 then
    if v_type in ('all', 'users') then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', user_id,
            'name', name,
            'avatarUrl', avatar_url,
            'bio', bio,
            'role', role,
            'isVerifiedCoach', verified,
            'postCount', post_count,
            'followerCount', follower_count
          )
          order by sort_rank asc, sort_ts desc, name asc
        ),
        '[]'::jsonb
      ),
      count(*)
      into v_users, v_user_count
      from (
        select distinct on (user_id)
          user_id,
          name,
          avatar_url,
          bio,
          role,
          verified,
          post_count,
          follower_count,
          sort_rank,
          sort_ts
        from (
          select
            p.id as user_id,
            coalesce(nullif(trim(p.full_name), ''), 'Member') as name,
            p.avatar_url,
            p.bio,
            p.role,
            public.feed_is_verified_coach(p.id) as verified,
            (
              select count(*)::int
              from public.feed_posts fp
              where fp.author_id = p.id
                and fp.status = 'published'
                and fp.deleted_at is null
                and public.can_access_feed_discipline(v_user, fp.discipline_id)
            ) as post_count,
            (
              select count(*)::int
              from public.feed_profile_follows f
              where f.followee_id = p.id
            ) as follower_count,
            0 as sort_rank,
            f.created_at as sort_ts
          from public.feed_profile_follows f
          join public.profiles p on p.id = f.followee_id
          where f.follower_id = v_user
            and exists (
              select 1
              from public.feed_posts fp
              where fp.author_id = p.id
                and fp.status = 'published'
                and fp.deleted_at is null
                and public.can_access_feed_discipline(v_user, fp.discipline_id)
            )

          union all

          select
            p.id,
            coalesce(nullif(trim(p.full_name), ''), 'Member'),
            p.avatar_url,
            p.bio,
            p.role,
            public.feed_is_verified_coach(p.id),
            (
              select count(*)::int
              from public.feed_posts fp
              where fp.author_id = p.id
                and fp.status = 'published'
                and fp.deleted_at is null
                and public.can_access_feed_discipline(v_user, fp.discipline_id)
            ),
            (
              select count(*)::int
              from public.feed_profile_follows ff
              where ff.followee_id = p.id
            ),
            1,
            max(fc.created_at)
          from public.feed_comments fc
          join public.feed_posts fp on fp.id = fc.post_id
          join public.profiles p on p.id = fp.author_id
          where fc.author_id = v_user
            and fc.deleted_at is null
            and fc.status = 'visible'
            and fp.status = 'published'
            and fp.deleted_at is null
            and fp.author_id <> v_user
            and public.can_access_feed_discipline(v_user, fp.discipline_id)
          group by p.id, p.full_name, p.avatar_url, p.bio, p.role
        ) candidates
        order by user_id, sort_rank asc, sort_ts desc
      ) rows
      order by sort_rank asc, sort_ts desc, name asc
      offset v_offset
      limit v_limit;
    end if;

    if v_type in ('all', 'posts') then
      select coalesce(jsonb_agg(row_data order by sort_rank asc, sort_ts desc, id desc), '[]'::jsonb),
             count(*)
        into v_posts, v_post_count
      from (
        select distinct on (fp.id)
          fp.id,
          public.feed_post_as_json(fp.id, v_user) as row_data,
          case
            when fc.id is not null then 0
            when fl.post_id is not null then 1
            else 2
          end as sort_rank,
          coalesce(fc.created_at, fl.created_at, fp.published_at) as sort_ts
        from public.feed_posts fp
        left join lateral (
          select fc_inner.id, fc_inner.created_at
          from public.feed_comments fc_inner
          where fc_inner.post_id = fp.id
            and fc_inner.author_id = v_user
            and fc_inner.deleted_at is null
            and fc_inner.status = 'visible'
          order by fc_inner.created_at desc
          limit 1
        ) fc on true
        left join public.feed_likes fl
          on fl.post_id = fp.id
         and fl.user_id = v_user
        where fp.status = 'published'
          and fp.deleted_at is null
          and public.can_access_feed_discipline(v_user, fp.discipline_id)
          and (
            fc.id is not null
            or fl.post_id is not null
            or true
          )
        order by fp.id, sort_rank asc, sort_ts desc
      ) ranked
      order by sort_rank asc, sort_ts desc, id desc
      offset v_offset
      limit v_limit;
    end if;

    return jsonb_build_object(
      'users', v_users,
      'posts', v_posts,
      'nextOffset', case when greatest(v_user_count, v_post_count) = v_limit then v_offset + v_limit else null end
    );
  end if;

  if v_type in ('all', 'users') then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', user_id,
          'name', name,
          'avatarUrl', avatar_url,
          'bio', bio,
          'role', role,
          'isVerifiedCoach', verified,
          'postCount', post_count,
          'followerCount', follower_count
        )
        order by post_count desc, name asc
      ),
      '[]'::jsonb
    ),
    count(*)
    into v_users, v_user_count
    from (
      select
        p.id as user_id,
        coalesce(nullif(trim(p.full_name), ''), 'Member') as name,
        p.avatar_url,
        p.bio,
        p.role,
        public.feed_is_verified_coach(p.id) as verified,
        (
          select count(*)::int
          from public.feed_posts fp
          where fp.author_id = p.id
            and fp.status = 'published'
            and fp.deleted_at is null
            and public.can_access_feed_discipline(v_user, fp.discipline_id)
        ) as post_count,
        (
          select count(*)::int
          from public.feed_profile_follows f
          where f.followee_id = p.id
        ) as follower_count
      from public.profiles p
      where (
          p.full_name ilike '%' || v_query || '%'
          or p.bio ilike '%' || v_query || '%'
        )
        and exists (
          select 1
          from public.feed_posts fp
          where fp.author_id = p.id
            and fp.status = 'published'
            and fp.deleted_at is null
            and public.can_access_feed_discipline(v_user, fp.discipline_id)
        )
      order by post_count desc, name asc
      offset v_offset
      limit v_limit
    ) rows;
  end if;

  if v_type in ('all', 'posts') then
    select coalesce(jsonb_agg(row_data order by published_at desc, id desc), '[]'::jsonb),
           count(*)
      into v_posts, v_post_count
    from (
      select
        fp.id,
        fp.published_at,
        public.feed_post_as_json(fp.id, v_user) as row_data
      from public.feed_posts fp
      join public.profiles p on p.id = fp.author_id
      join public.disciplines d on d.id = fp.discipline_id
      where fp.status = 'published'
        and fp.deleted_at is null
        and public.can_access_feed_discipline(v_user, fp.discipline_id)
        and (
          fp.body ilike '%' || v_query || '%'
          or p.full_name ilike '%' || v_query || '%'
          or d.display_name ilike '%' || v_query || '%'
        )
      order by fp.published_at desc, fp.id desc
      offset v_offset
      limit v_limit
    ) rows;
  end if;

  return jsonb_build_object(
    'users', v_users,
    'posts', v_posts,
    'nextOffset', case when greatest(v_user_count, v_post_count) = v_limit then v_offset + v_limit else null end
  );
end;
$$;

grant execute on function public.search_feed(text, text, int, int) to authenticated;
