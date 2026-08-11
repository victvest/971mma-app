-- Social feed MVP: discipline-scoped posts, comments, likes, media, search,
-- profile previews, notifications, and admin moderation.

alter table public.profiles
  add column if not exists bio text;

create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  discipline_id uuid not null references public.disciplines(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  media jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('published', 'hidden', 'deleted')),
  like_count int not null default 0 check (like_count >= 0),
  comment_count int not null default 0 check (comment_count >= 0),
  share_count int not null default 0 check (share_count >= 0),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.feed_likes (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.feed_profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table if not exists public.feed_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  action text not null check (action in ('hide', 'restore', 'delete')),
  reason text,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_feed_posts_discipline_published
  on public.feed_posts (discipline_id, published_at desc, id desc)
  where status = 'published' and deleted_at is null;

create index if not exists idx_feed_posts_author_published
  on public.feed_posts (author_id, published_at desc, id desc)
  where status = 'published' and deleted_at is null;

create index if not exists idx_feed_comments_post_created
  on public.feed_comments (post_id, created_at asc, id asc)
  where status = 'visible' and deleted_at is null;

create index if not exists idx_feed_moderation_target
  on public.feed_moderation_actions (target_type, target_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feed-media',
  'feed-media',
  true,
  10485760,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Feed media is publicly readable" on storage.objects;
create policy "Feed media is publicly readable"
on storage.objects for select
using (bucket_id = 'feed-media');

drop policy if exists "Users can upload their own feed media" on storage.objects;
create policy "Users can upload their own feed media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'feed-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own feed media" on storage.objects;
create policy "Users can update their own feed media"
on storage.objects for update to authenticated
using (
  bucket_id = 'feed-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'feed-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own feed media" on storage.objects;
create policy "Users can delete their own feed media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'feed-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

alter table public.feed_posts enable row level security;
alter table public.feed_likes enable row level security;
alter table public.feed_comments enable row level security;
alter table public.feed_profile_follows enable row level security;
alter table public.feed_moderation_actions enable row level security;

create or replace function public.feed_is_verified_coach(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user
      and p.role = 'coach'
  )
  or exists (
    select 1
    from public.coaches c
    where c.user_id = p_user
      and c.active = true
      and c.deleted_at is null
  );
$$;

create or replace function public.can_access_feed_discipline(
  p_user uuid,
  p_discipline_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null
    and exists (
      select 1
      from public.disciplines d
      where d.id = p_discipline_id
        and d.active = true
    )
    and (
      public.is_admin()
      or exists (
        select 1
        from public.member_disciplines md
        where md.user_id = p_user
          and md.discipline_id = p_discipline_id
          and md.active = true
          and (md.ends_on is null or md.ends_on >= current_date)
      )
      or (
        (
          exists (
            select 1
            from public.profiles p
            where p.id = p_user
              and p.membership_status = 'active'
          )
          or exists (
            select 1
            from public.member_memberships mm
            where mm.user_id = p_user
              and mm.status in ('active', 'Active', 'current', 'Current')
              and (mm.end_date is null or mm.end_date >= now())
          )
        )
        and not exists (
          select 1
          from public.member_disciplines md_any
          where md_any.user_id = p_user
            and md_any.active = true
            and (md_any.ends_on is null or md_any.ends_on >= current_date)
        )
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = p_user
          and p.role = 'coach'
      )
      or exists (
        select 1
        from public.coaches c
        where c.user_id = p_user
          and c.active = true
          and c.deleted_at is null
          and public.coach_has_discipline_access(c.id, p_discipline_id)
      )
    );
$$;

create or replace function public.feed_accessible_disciplines(p_user uuid default auth.uid())
returns table (
  id uuid,
  slug text,
  display_name text,
  has_rank_progression boolean,
  is_member_discipline boolean,
  sort_order int
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    d.id,
    d.slug,
    d.display_name,
    d.has_rank_progression,
    exists (
      select 1
      from public.member_disciplines md
      where md.user_id = p_user
        and md.discipline_id = d.id
        and md.active = true
        and (md.ends_on is null or md.ends_on >= current_date)
    ) as is_member_discipline,
    d.sort_order
  from public.disciplines d
  where d.active = true
    and public.can_access_feed_discipline(p_user, d.id)
  order by d.sort_order asc, d.display_name asc;
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
    and fp.deleted_at is null
    and public.can_access_feed_discipline(p_viewer_id, fp.discipline_id);
$$;

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
    and fp.deleted_at is null
    and public.can_access_feed_discipline(p_viewer_id, fp.discipline_id);
$$;

create or replace function public.recompute_feed_post_comment_count(p_post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.feed_posts
  set comment_count = (
        select count(*)::int
        from public.feed_comments fc
        where fc.post_id = p_post_id
          and fc.status = 'visible'
          and fc.deleted_at is null
      ),
      updated_at = now()
  where id = p_post_id;
$$;

create or replace function public.handle_feed_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.feed_posts
    set like_count = like_count + 1,
        updated_at = now()
    where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.feed_posts
    set like_count = greatest(like_count - 1, 0),
        updated_at = now()
    where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists feed_like_count_insert on public.feed_likes;
create trigger feed_like_count_insert
after insert on public.feed_likes
for each row execute function public.handle_feed_like_count();

drop trigger if exists feed_like_count_delete on public.feed_likes;
create trigger feed_like_count_delete
after delete on public.feed_likes
for each row execute function public.handle_feed_like_count();

create or replace function public.handle_feed_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recompute_feed_post_comment_count(new.post_id);
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.recompute_feed_post_comment_count(new.post_id);
    if old.post_id is distinct from new.post_id then
      perform public.recompute_feed_post_comment_count(old.post_id);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.recompute_feed_post_comment_count(old.post_id);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists feed_comment_count_insert on public.feed_comments;
create trigger feed_comment_count_insert
after insert on public.feed_comments
for each row execute function public.handle_feed_comment_count();

drop trigger if exists feed_comment_count_update on public.feed_comments;
create trigger feed_comment_count_update
after update on public.feed_comments
for each row execute function public.handle_feed_comment_count();

drop trigger if exists feed_comment_count_delete on public.feed_comments;
create trigger feed_comment_count_delete
after delete on public.feed_comments
for each row execute function public.handle_feed_comment_count();

drop policy if exists "feed_posts select accessible" on public.feed_posts;
create policy "feed_posts select accessible"
on public.feed_posts for select to authenticated
using (
  status = 'published'
  and deleted_at is null
  and public.can_access_feed_discipline(auth.uid(), discipline_id)
);

drop policy if exists "feed_likes select accessible" on public.feed_likes;
create policy "feed_likes select accessible"
on public.feed_likes for select to authenticated
using (
  exists (
    select 1
    from public.feed_posts fp
    where fp.id = post_id
      and fp.status = 'published'
      and fp.deleted_at is null
      and public.can_access_feed_discipline(auth.uid(), fp.discipline_id)
  )
);

drop policy if exists "feed_comments select accessible" on public.feed_comments;
create policy "feed_comments select accessible"
on public.feed_comments for select to authenticated
using (
  status = 'visible'
  and deleted_at is null
  and exists (
    select 1
    from public.feed_posts fp
    where fp.id = post_id
      and fp.status = 'published'
      and fp.deleted_at is null
      and public.can_access_feed_discipline(auth.uid(), fp.discipline_id)
  )
);

drop policy if exists "feed_profile_follows select own" on public.feed_profile_follows;
create policy "feed_profile_follows select own"
on public.feed_profile_follows for select to authenticated
using (auth.uid() = follower_id or auth.uid() = followee_id or public.is_admin());

drop policy if exists "feed_profile_follows insert own" on public.feed_profile_follows;
create policy "feed_profile_follows insert own"
on public.feed_profile_follows for insert to authenticated
with check (auth.uid() = follower_id);

drop policy if exists "feed_profile_follows delete own" on public.feed_profile_follows;
create policy "feed_profile_follows delete own"
on public.feed_profile_follows for delete to authenticated
using (auth.uid() = follower_id);

drop policy if exists "feed_moderation_actions select admin" on public.feed_moderation_actions;
create policy "feed_moderation_actions select admin"
on public.feed_moderation_actions for select to authenticated
using (public.is_admin());

create or replace function public.list_feed_disciplines()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
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
  from public.feed_accessible_disciplines(auth.uid());
$$;

create or replace function public.list_feed_posts(
  p_discipline_id uuid default null,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit int default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_limit int := greatest(least(coalesce(p_limit, 12), 30), 1);
  v_posts jsonb := '[]'::jsonb;
  v_count int := 0;
  v_next_published_at timestamptz;
  v_next_id uuid;
  v_disciplines jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if p_discipline_id is not null and not public.can_access_feed_discipline(v_user, p_discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(row_data order by published_at desc, id desc), '[]'::jsonb),
         count(*)
    into v_posts, v_count
  from (
    select
      fp.id,
      fp.published_at,
      public.feed_post_as_json(fp.id, v_user) as row_data
    from public.feed_posts fp
    where fp.status = 'published'
      and fp.deleted_at is null
      and (p_discipline_id is null or fp.discipline_id = p_discipline_id)
      and public.can_access_feed_discipline(v_user, fp.discipline_id)
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
      and public.can_access_feed_discipline(v_user, fp.discipline_id)
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
  from public.feed_accessible_disciplines(v_user);

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
  p_media jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_media jsonb := coalesce(p_media, '[]'::jsonb);
  v_post public.feed_posts%rowtype;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if p_discipline_id is null or not public.can_access_feed_discipline(v_user, p_discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if char_length(v_body) = 0 or char_length(v_body) > 1000 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if jsonb_typeof(v_media) <> 'array' or jsonb_array_length(v_media) > 4 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  insert into public.feed_posts (author_id, discipline_id, body, media, status, published_at)
  values (v_user, p_discipline_id, v_body, v_media, 'published', now())
  returning * into v_post;

  return public.feed_post_as_json(v_post.id, v_user);
end;
$$;

create or replace function public.delete_own_feed_post(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  update public.feed_posts
  set status = 'deleted',
      deleted_at = now(),
      updated_at = now()
  where id = p_post_id
    and author_id = v_user
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true, 'postId', p_post_id);
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
  v_actor_name text;
  v_removed boolean := false;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  select * into v_post
  from public.feed_posts
  where id = p_post_id
    and status = 'published'
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if not public.can_access_feed_discipline(v_user, v_post.discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
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

  select * into v_post
  from public.feed_posts
  where id = p_post_id
    and status = 'published'
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if not public.can_access_feed_discipline(v_user, v_post.discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  update public.feed_posts
  set share_count = share_count + 1,
      updated_at = now()
  where id = p_post_id;

  return public.feed_post_as_json(p_post_id, v_user);
end;
$$;

create or replace function public.list_feed_comments(
  p_post_id uuid,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit int default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_post public.feed_posts%rowtype;
  v_limit int := greatest(least(coalesce(p_limit, 20), 50), 1);
  v_comments jsonb := '[]'::jsonb;
  v_count int := 0;
  v_next_created_at timestamptz;
  v_next_id uuid;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  select * into v_post
  from public.feed_posts
  where id = p_post_id
    and status = 'published'
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if not public.can_access_feed_discipline(v_user, v_post.discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(row_data order by created_at asc, id asc), '[]'::jsonb),
         count(*)
    into v_comments, v_count
  from (
    select
      fc.id,
      fc.created_at,
      public.feed_comment_as_json(fc.id, v_user) as row_data
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

  select * into v_post
  from public.feed_posts
  where id = p_post_id
    and status = 'published'
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if not public.can_access_feed_discipline(v_user, v_post.discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
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

create or replace function public.delete_own_feed_comment(p_comment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_post_id uuid;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  update public.feed_comments
  set status = 'deleted',
      deleted_at = now(),
      updated_at = now()
  where id = p_comment_id
    and author_id = v_user
    and deleted_at is null
  returning post_id into v_post_id;

  if v_post_id is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'ok', true,
    'commentId', p_comment_id,
    'post', public.feed_post_as_json(v_post_id, v_user)
  );
end;
$$;

create or replace function public.get_feed_post_thread(p_post_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_post jsonb;
  v_comments jsonb;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  v_post := public.feed_post_as_json(p_post_id, v_user);
  if v_post is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  v_comments := public.list_feed_comments(p_post_id, null, null, 20);
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
  p_limit int default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_profile jsonb;
  v_posts jsonb := '[]'::jsonb;
  v_count int := 0;
  v_limit int := greatest(least(coalesce(p_limit, 12), 30), 1);
  v_next_published_at timestamptz;
  v_next_id uuid;
begin
  if v_viewer is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'name', coalesce(nullif(trim(p.full_name), ''), 'Member'),
    'avatarUrl', p.avatar_url,
    'bio', p.bio,
    'role', p.role,
    'isVerifiedCoach', public.feed_is_verified_coach(p.id),
    'postCount', (
      select count(*)::int
      from public.feed_posts fp
      where fp.author_id = p.id
        and fp.status = 'published'
        and fp.deleted_at is null
        and public.can_access_feed_discipline(v_viewer, fp.discipline_id)
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
        and f.follower_id = v_viewer
    )
  )
  into v_profile
  from public.profiles p
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
      public.feed_post_as_json(fp.id, v_viewer) as row_data
    from public.feed_posts fp
    where fp.author_id = p_user_id
      and fp.status = 'published'
      and fp.deleted_at is null
      and public.can_access_feed_discipline(v_viewer, fp.discipline_id)
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
      and public.can_access_feed_discipline(v_viewer, fp.discipline_id)
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

create or replace function public.admin_list_feed_moderation(
  p_status text default null,
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  target_type text,
  target_id uuid,
  post_id uuid,
  discipline_name text,
  author_name text,
  preview text,
  status text,
  like_count int,
  comment_count int,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := nullif(lower(trim(coalesce(p_status, ''))), '');
begin
  perform public.require_admin();

  return query
  (
    select
      'post'::text as target_type,
      fp.id as target_id,
      fp.id as post_id,
      d.display_name as discipline_name,
      coalesce(nullif(trim(p.full_name), ''), 'Member') as author_name,
      left(fp.body, 180) as preview,
      fp.status as status,
      fp.like_count as like_count,
      fp.comment_count as comment_count,
      fp.published_at as created_at
    from public.feed_posts fp
    join public.profiles p on p.id = fp.author_id
    join public.disciplines d on d.id = fp.discipline_id
    where fp.deleted_at is null
      and fp.status in ('published', 'hidden')
      and (v_status is null or fp.status = v_status)
  )
  union all
  (
    select
      'comment'::text as target_type,
      fc.id as target_id,
      fc.post_id as post_id,
      d.display_name as discipline_name,
      coalesce(nullif(trim(p.full_name), ''), 'Member') as author_name,
      left(fc.body, 180) as preview,
      case when fc.status = 'visible' then 'published' else fc.status end as status,
      0 as like_count,
      0 as comment_count,
      fc.created_at as created_at
    from public.feed_comments fc
    join public.feed_posts fp on fp.id = fc.post_id
    join public.profiles p on p.id = fc.author_id
    join public.disciplines d on d.id = fp.discipline_id
    where fc.deleted_at is null
      and fc.status in ('visible', 'hidden')
      and (
        v_status is null
        or case when fc.status = 'visible' then 'published' else fc.status end = v_status
      )
  )
  order by created_at desc
  limit greatest(least(coalesce(p_limit, 25), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_moderate_feed(
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_type text := lower(trim(coalesce(p_target_type, '')));
  v_action text := lower(trim(coalesce(p_action, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_post_id uuid;
begin
  perform public.require_admin();

  if v_target_type = 'post' and v_action in ('hide', 'restore', 'delete') then
    update public.feed_posts
    set status = case
          when v_action = 'hide' then 'hidden'
          when v_action = 'delete' then 'deleted'
          else 'published'
        end,
        deleted_at = case when v_action = 'delete' then now() else null end,
        updated_at = now()
    where id = p_target_id
    returning id into v_post_id;
  elsif v_target_type = 'comment' and v_action in ('hide', 'restore', 'delete') then
    update public.feed_comments
    set status = case
          when v_action = 'hide' then 'hidden'
          when v_action = 'delete' then 'deleted'
          else 'visible'
        end,
        deleted_at = case when v_action = 'delete' then now() else null end,
        updated_at = now()
    where id = p_target_id
    returning post_id into v_post_id;
  else
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_post_id is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  insert into public.feed_moderation_actions (
    target_type,
    target_id,
    action,
    reason,
    performed_by
  )
  values (
    v_target_type,
    p_target_id,
    v_action,
    v_reason,
    auth.uid()
  );

  perform public.write_admin_audit(
    'moderate_feed_' || v_action,
    v_target_type,
    p_target_id::text,
    jsonb_build_object('reason', v_reason)
  );

  return jsonb_build_object('ok', true, 'postId', v_post_id);
end;
$$;

revoke execute on function public.feed_is_verified_coach(uuid) from public, anon;
revoke execute on function public.can_access_feed_discipline(uuid, uuid) from public, anon;
revoke execute on function public.feed_accessible_disciplines(uuid) from public, anon;
revoke execute on function public.feed_post_as_json(uuid, uuid) from public, anon;
revoke execute on function public.feed_comment_as_json(uuid, uuid) from public, anon;
revoke execute on function public.recompute_feed_post_comment_count(uuid) from public, anon;
revoke execute on function public.handle_feed_like_count() from public, anon;
revoke execute on function public.handle_feed_comment_count() from public, anon;

grant execute on function public.list_feed_disciplines() to authenticated;
grant execute on function public.list_feed_posts(uuid, timestamptz, uuid, int) to authenticated;
grant execute on function public.create_feed_post(uuid, text, jsonb) to authenticated;
grant execute on function public.delete_own_feed_post(uuid) to authenticated;
grant execute on function public.toggle_feed_like(uuid) to authenticated;
grant execute on function public.record_feed_share(uuid) to authenticated;
grant execute on function public.list_feed_comments(uuid, timestamptz, uuid, int) to authenticated;
grant execute on function public.create_feed_comment(uuid, text) to authenticated;
grant execute on function public.delete_own_feed_comment(uuid) to authenticated;
grant execute on function public.get_feed_post_thread(uuid) to authenticated;
grant execute on function public.get_feed_profile(uuid, timestamptz, uuid, int) to authenticated;
grant execute on function public.search_feed(text, text, int, int) to authenticated;
grant execute on function public.admin_list_feed_moderation(text, int, int) to authenticated;
grant execute on function public.admin_moderate_feed(text, uuid, text, text) to authenticated;
