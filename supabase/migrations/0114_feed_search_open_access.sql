-- Align feed search with open feed access (see 0113): stop gating search by member_disciplines.

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

  if char_length(v_query) < 2 then
    return jsonb_build_object('users', '[]'::jsonb, 'posts', '[]'::jsonb, 'nextOffset', null);
  end if;

  if v_type not in ('all', 'users', 'posts') then
    v_type := 'all';
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
          'beltRank', belt_rank,
          'beltStripes', belt_stripes,
          'primaryDiscipline', primary_discipline,
          'memberSince', member_since,
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
        coalesce(rank_progress.name, p.belt_rank) as belt_rank,
        coalesce(rank_progress.stripe, p.belt_stripes, 0) as belt_stripes,
        rank_progress.discipline_name as primary_discipline,
        p.member_since,
        (
          select count(*)::int
          from public.feed_posts fp
          where fp.author_id = p.id
            and fp.status = 'published'
            and fp.deleted_at is null
        ) as post_count,
        (
          select count(*)::int
          from public.feed_profile_follows f
          where f.followee_id = p.id
        ) as follower_count
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
        and (
          fp.body ilike '%' || v_query || '%'
          or p.full_name ilike '%' || v_query || '%'
          or d.display_name ilike '%' || v_query || '%'
          or d.slug ilike '%' || replace(lower(v_query), ' ', '_') || '%'
        )
      order by fp.published_at desc, fp.id desc
      offset v_offset
      limit v_limit
    ) rows
    where row_data is not null;
  end if;

  return jsonb_build_object(
    'users', v_users,
    'posts', v_posts,
    'nextOffset', case when greatest(v_user_count, v_post_count) = v_limit then v_offset + v_limit else null end
  );
end;
$$;
