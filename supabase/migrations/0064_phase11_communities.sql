-- Phase 11: Coach-led discipline communities with reactions, replies, and admin moderation.

create table if not exists public.community_channels (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  discipline_id uuid not null references public.disciplines(id) on delete restrict,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (coach_id, discipline_id)
);

create table if not exists public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  muted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, user_id)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.community_channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  body text not null check (char_length(trim(body)) > 0),
  media_url text,
  status text not null default 'published' check (status in ('published', 'hidden', 'deleted')),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '🔥', '💪', '❤️')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.community_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'reply', 'channel')),
  target_id uuid not null,
  action text not null check (action in ('hide', 'restore', 'archive', 'delete')),
  reason text,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_channels_discipline_status
  on public.community_channels (discipline_id, status)
  where deleted_at is null;

create index if not exists idx_community_memberships_user
  on public.community_memberships (user_id, channel_id);

create index if not exists idx_community_posts_channel_published
  on public.community_posts (channel_id, published_at desc)
  where status = 'published' and deleted_at is null;

create index if not exists idx_community_replies_post_created
  on public.community_replies (post_id, created_at asc)
  where status = 'visible' and deleted_at is null;

create index if not exists idx_community_moderation_actions_target
  on public.community_moderation_actions (target_type, target_id, created_at desc);

-- Seed channels for active coaches with discipline assignments.
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
where co.active = true
  and co.deleted_at is null
on conflict (coach_id, discipline_id) do update
set title = excluded.title,
    description = excluded.description,
    updated_at = now();

alter table public.community_channels enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_moderation_actions enable row level security;

create or replace function public.can_access_community_channel(p_channel_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_channels ch
    where ch.id = p_channel_id
      and ch.deleted_at is null
      and ch.status = 'active'
      and (
        public.is_admin()
        or exists (
          select 1
          from public.community_memberships cm
          where cm.channel_id = ch.id
            and cm.user_id = p_user_id
            and cm.joined_at is not null
        )
        or exists (
          select 1
          from public.coaches c
          where c.id = ch.coach_id
            and c.user_id = p_user_id
            and c.deleted_at is null
        )
      )
  );
$$;

create or replace function public.sync_community_memberships(p_user uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_count int := 0;
begin
  if v_user is null then
    return 0;
  end if;

  insert into public.community_memberships (channel_id, user_id, joined_at)
  select distinct ch.id, v_user, now()
  from public.community_channels ch
  join public.member_disciplines md
    on md.discipline_id = ch.discipline_id
   and md.user_id = v_user
   and md.active = true
  where ch.status = 'active'
    and ch.deleted_at is null
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.ensure_coach_community_channel(
  p_coach_id uuid,
  p_discipline_id uuid
)
returns public.community_channels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.community_channels;
  v_coach public.coaches%rowtype;
  v_discipline public.disciplines%rowtype;
begin
  select * into v_coach from public.coaches where id = p_coach_id and deleted_at is null;
  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select * into v_discipline from public.disciplines where id = p_discipline_id and active = true;
  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  insert into public.community_channels (coach_id, discipline_id, title, description, status)
  values (
    p_coach_id,
    p_discipline_id,
    v_coach.name || ' · ' || v_discipline.display_name,
    'Coach updates and discussion for ' || v_discipline.display_name || ' members.',
    'active'
  )
  on conflict (coach_id, discipline_id) do update
  set title = excluded.title,
      description = excluded.description,
      updated_at = now(),
      status = case when public.community_channels.status = 'archived' then 'active' else public.community_channels.status end
  returning * into v_row;

  return v_row;
end;
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
    select cp.published_at
    from public.community_posts cp
    where cp.channel_id = ch.id
      and cp.status = 'published'
      and cp.deleted_at is null
    order by cp.published_at desc
    limit 1
  ) latest on true
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

create or replace function public.list_coach_community_channels()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.coach_id_for_user();
  v_channels jsonb := '[]'::jsonb;
begin
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
    select jsonb_build_object(
      'id', cp.id,
      'channelId', cp.channel_id,
      'authorId', cp.author_id,
      'authorName', coalesce(pr.full_name, 'Coach'),
      'authorAvatarUrl', pr.avatar_url,
      'title', cp.title,
      'body', cp.body,
      'mediaUrl', cp.media_url,
      'publishedAt', cp.published_at,
      'reactionCounts', coalesce(reactions.counts, '{}'::jsonb),
      'replyCount', coalesce(replies.cnt, 0),
      'myReactions', coalesce(reactions.mine, '[]'::jsonb)
    ) as row_data,
    cp.published_at
    from public.community_posts cp
    join public.profiles pr on pr.id = cp.author_id
    left join lateral (
      select
        coalesce(jsonb_object_agg(r.emoji, r.cnt) filter (where r.emoji is not null), '{}'::jsonb) as counts,
        coalesce(jsonb_agg(r.emoji) filter (where r.mine), '[]'::jsonb) as mine
      from (
        select
          cr.emoji,
          count(*)::int as cnt,
          bool_or(cr.user_id = v_user) as mine
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

  select jsonb_build_object(
    'id', cp.id,
    'channelId', cp.channel_id,
    'authorId', cp.author_id,
    'authorName', coalesce(pr.full_name, 'Coach'),
    'authorAvatarUrl', pr.avatar_url,
    'title', cp.title,
    'body', cp.body,
    'mediaUrl', cp.media_url,
    'publishedAt', cp.published_at,
    'reactionCounts', coalesce(reactions.counts, '{}'::jsonb),
    'replyCount', coalesce(replies.cnt, 0),
    'myReactions', coalesce(reactions.mine, '[]'::jsonb)
  )
  into v_post
  from public.community_posts cp
  join public.profiles pr on pr.id = cp.author_id
  left join lateral (
    select
      coalesce(jsonb_object_agg(r.emoji, r.cnt) filter (where r.emoji is not null), '{}'::jsonb) as counts,
      coalesce(jsonb_agg(r.emoji) filter (where r.mine), '[]'::jsonb) as mine
    from (
      select
        cr.emoji,
        count(*)::int as cnt,
        bool_or(cr.user_id = v_user) as mine
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
  where cp.id = p_post_id;

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

create or replace function public.toggle_community_reaction(
  p_post_id uuid,
  p_emoji text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_channel_id uuid;
  v_emoji text := trim(coalesce(p_emoji, ''));
  v_removed boolean := false;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if v_emoji not in ('👍', '🔥', '💪', '❤️') then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
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

  delete from public.community_reactions
  where post_id = p_post_id
    and user_id = v_user
    and emoji = v_emoji;

  if found then
    v_removed := true;
  else
    insert into public.community_reactions (post_id, user_id, emoji)
    values (p_post_id, v_user, v_emoji);
  end if;

  return public.get_community_post_thread(p_post_id)
    || jsonb_build_object('reactionToggled', jsonb_build_object('emoji', v_emoji, 'removed', v_removed));
end;
$$;

create or replace function public.create_community_reply(
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
  v_channel_id uuid;
  v_body text := trim(coalesce(p_body, ''));
  v_reply public.community_replies%rowtype;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if v_body = '' then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
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

  insert into public.community_replies (post_id, user_id, body, status)
  values (p_post_id, v_user, v_body, 'visible')
  returning * into v_reply;

  return public.get_community_post_thread(p_post_id);
end;
$$;

create or replace function public.publish_community_post(
  p_channel_id uuid,
  p_title text default null,
  p_body text default null
)
returns public.community_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_coach_id uuid := public.coach_id_for_user();
  v_channel public.community_channels%rowtype;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_body text := trim(coalesce(p_body, ''));
  v_post public.community_posts%rowtype;
begin
  if v_user is null or v_coach_id is null then
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
  created_at timestamptz
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
      cp.published_at
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
      cr.created_at
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

create or replace function public.admin_moderate_community(
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
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  perform public.require_admin();

  if p_target_type = 'post' and p_action in ('hide', 'restore', 'delete') then
    update public.community_posts
    set status = case
          when p_action = 'hide' then 'hidden'
          when p_action = 'delete' then 'deleted'
          else 'published'
        end,
        deleted_at = case when p_action = 'delete' then now() else null end,
        updated_at = now()
    where id = p_target_id;
  elsif p_target_type = 'reply' and p_action in ('hide', 'restore', 'delete') then
    update public.community_replies
    set status = case
          when p_action = 'hide' then 'hidden'
          when p_action = 'delete' then 'deleted'
          else 'visible'
        end,
        deleted_at = case when p_action = 'delete' then now() else null end,
        updated_at = now()
    where id = p_target_id;
  elsif p_target_type = 'channel' and p_action in ('archive', 'restore', 'delete') then
    update public.community_channels
    set status = case
          when p_action = 'archive' then 'archived'
          when p_action = 'delete' then 'archived'
          else 'active'
        end,
        deleted_at = case when p_action = 'delete' then now() else null end,
        updated_at = now()
    where id = p_target_id;
  else
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  insert into public.community_moderation_actions (
    target_type,
    target_id,
    action,
    reason,
    performed_by
  )
  values (
    p_target_type,
    p_target_id,
    p_action,
    v_reason,
    auth.uid()
  );

  perform public.write_admin_audit(
    'moderate_community_' || p_action,
    p_target_type,
    p_target_id::text,
    jsonb_build_object('reason', v_reason)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.can_access_community_channel(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sync_community_memberships(uuid) from public, anon, authenticated;
revoke execute on function public.ensure_coach_community_channel(uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_community_channels() to authenticated;
grant execute on function public.list_coach_community_channels() to authenticated;
grant execute on function public.list_community_channel_posts(uuid, int, int) to authenticated;
grant execute on function public.get_community_post_thread(uuid) to authenticated;
grant execute on function public.toggle_community_reaction(uuid, text) to authenticated;
grant execute on function public.create_community_reply(uuid, text) to authenticated;
grant execute on function public.publish_community_post(uuid, text, text) to authenticated;
grant execute on function public.admin_list_community_moderation(int, int) to authenticated;
grant execute on function public.admin_moderate_community(text, uuid, text, text) to authenticated;
