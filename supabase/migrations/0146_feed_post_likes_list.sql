-- Migration: 0146_feed_post_likes_list.sql
-- Description: RPC to list users who liked a feed post with their profile details.

create or replace function public.list_feed_post_likes(
  p_post_id uuid,
  p_limit int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_post public.feed_posts%rowtype;
  v_likes jsonb;
begin
  select * into v_post
  from public.feed_posts
  where id = p_post_id
    and status = 'published'
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pr.id,
        'name', coalesce(nullif(trim(pr.full_name), ''), 'Member'),
        'avatarUrl', pr.avatar_url,
        'bio', pr.bio,
        'role', pr.role,
        'isVerifiedCoach', public.feed_is_verified_coach(pr.id),
        'beltRank', pr.belt_rank,
        'beltStripes', coalesce(pr.belt_stripes, 0),
        'likedAt', fl.created_at
      )
      order by fl.created_at desc
    ),
    '[]'::jsonb
  )
  into v_likes
  from (
    select fl.user_id, fl.created_at
    from public.feed_likes fl
    where fl.post_id = p_post_id
    order by fl.created_at desc
    limit coalesce(p_limit, 50)
  ) fl
  join public.profiles pr on pr.id = fl.user_id;

  return jsonb_build_object(
    'likes', coalesce(v_likes, '[]'::jsonb),
    'count', jsonb_array_length(coalesce(v_likes, '[]'::jsonb))
  );
end;
$$;

grant execute on function public.list_feed_post_likes(uuid, int) to authenticated, anon;
