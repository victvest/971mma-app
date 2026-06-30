-- Communities production readiness: realtime, read state, push fanout helpers,
-- membership sync via membership_product_disciplines, admin channel management,
-- reply notifications.

-- ── Realtime publication ──────────────────────────────────────────────────────

alter publication supabase_realtime add table public.community_posts;
alter publication supabase_realtime add table public.community_replies;

-- ── RLS select policies (required for Supabase Realtime) ─────────────────────

drop policy if exists "community_posts select members" on public.community_posts;
create policy "community_posts select members"
  on public.community_posts
  for select
  to authenticated
  using (
    status = 'published'
    and deleted_at is null
    and public.can_access_community_channel(channel_id)
  );

drop policy if exists "community_replies select members" on public.community_replies;
create policy "community_replies select members"
  on public.community_replies
  for select
  to authenticated
  using (
    status = 'visible'
    and deleted_at is null
    and exists (
      select 1
      from public.community_posts cp
      where cp.id = post_id
        and cp.status = 'published'
        and cp.deleted_at is null
        and public.can_access_community_channel(cp.channel_id)
    )
  );

-- ── Post JSON with per-message unread flag ────────────────────────────────────

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
    'myReactions', coalesce(reactions.mine, '[]'::jsonb),
    'isUnread', case
      when membership.last_read_at is null then cp.published_at > coalesce(membership.joined_at, '-infinity'::timestamptz)
      else cp.published_at > membership.last_read_at
    end
  )
  from public.community_posts cp
  join public.profiles pr on pr.id = cp.author_id
  join public.community_channels ch on ch.id = cp.channel_id
  join public.coaches co on co.id = ch.coach_id
  left join public.community_memberships membership
    on membership.channel_id = cp.channel_id
   and membership.user_id = p_viewer_id
   and membership.joined_at is not null
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

-- ── Membership sync: add membership_product_disciplines mapping ───────────────

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

  -- 1) Discipline entitlements from member_disciplines.
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

  -- 2) Class attendance.
  insert into public.community_memberships (channel_id, user_id, joined_at)
  select distinct ch.id, v_user, now()
  from public.check_ins ci
  join public.classes c on c.id = ci.class_id
  join public.community_channels ch
    on ch.discipline_id = c.discipline_id
   and ch.status = 'active'
   and ch.deleted_at is null
  where ci.user_id = v_user
    and ci.signed_in = true
    and coalesce(ci.missed, false) = false
    and coalesce(ci.late_cancelled, false) = false
    and c.discipline_id is not null
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  -- 3) Coach-owned groups.
  insert into public.community_memberships (channel_id, user_id, joined_at)
  select distinct ch.id, v_user, now()
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  where ch.status = 'active'
    and ch.deleted_at is null
    and co.active = true
    and co.deleted_at is null
    and (
      co.user_id = v_user
      or exists (
        select 1
        from public.profiles pr
        where pr.id = v_user
          and pr.full_name is not null
          and lower(trim(pr.full_name)) = lower(trim(co.name))
      )
    )
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  -- 4) Admin-configured membership product → discipline mappings.
  insert into public.community_memberships (channel_id, user_id, joined_at)
  select distinct ch.id, v_user, now()
  from public.member_memberships mm
  join public.membership_product_disciplines mpd
    on mpd.active = true
   and (
     (mpd.match_type = 'mindbody_id' and mm.mindbody_record_id = mpd.match_value)
     or (mpd.match_type = 'name_exact' and lower(trim(mm.name)) = lower(trim(mpd.match_value)))
     or (mpd.match_type = 'name_contains' and mm.name ilike '%' || mpd.match_value || '%')
   )
  join public.community_channels ch
    on ch.discipline_id = mpd.discipline_id
   and ch.status = 'active'
   and ch.deleted_at is null
  where mm.user_id = v_user
    and mm.status in ('active', 'Active', 'current', 'Current')
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  -- 5) Legacy name heuristics fallback.
  insert into public.community_memberships (channel_id, user_id, joined_at)
  select distinct ch.id, v_user, now()
  from public.member_memberships mm
  join public.community_channels ch on ch.status = 'active' and ch.deleted_at is null
  join public.disciplines d on d.id = ch.discipline_id and d.active = true
  where mm.user_id = v_user
    and mm.status in ('active', 'Active', 'current', 'Current')
    and (
      (d.slug = 'bjj' and (mm.name ilike '%jiu%' or mm.name ilike '%bjj%'))
      or (d.slug = 'wrestling' and mm.name ilike '%wrest%')
      or (d.slug = 'muay_thai' and (mm.name ilike '%muay%' or mm.name ilike '%thai%' or mm.name ilike '%strik%'))
      or (d.slug = 'mma' and (mm.name ilike '%mma%' or mm.name ilike '%mixed%'))
      or (d.slug = 'boxing' and mm.name ilike '%box%')
      or (d.slug = 'personal_training' and (mm.name ilike '%personal%' or mm.name ilike '%pt%'))
      or (d.slug = 'yoga_mobility' and (mm.name ilike '%yoga%' or mm.name ilike '%mobil%'))
      or (d.slug = 'performance_fitness' and (
        mm.name ilike '%fit%'
        or mm.name ilike '%strength%'
        or mm.name ilike '%cond%'
        or mm.name ilike '%performance%'
        or mm.name ilike '%unlimited%'
        or mm.name ilike '%membership%'
      ))
    )
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  return v_count;
end;
$$;

-- ── Reply notifications ───────────────────────────────────────────────────────

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
  v_post_author uuid;
  v_coach_user uuid;
  v_body text := trim(coalesce(p_body, ''));
  v_reply public.community_replies%rowtype;
  v_author_name text;
  v_is_coach_reply boolean := false;
begin
  if v_user is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  if v_body = '' then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select cp.channel_id, cp.author_id, co.user_id
    into v_channel_id, v_post_author, v_coach_user
  from public.community_posts cp
  join public.community_channels ch on ch.id = cp.channel_id
  join public.coaches co on co.id = ch.coach_id
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

  select coalesce(full_name, 'Member') into v_author_name
  from public.profiles where id = v_user;

  v_is_coach_reply := v_user = v_coach_user;

  -- Notify post author when someone else replies.
  if v_post_author is not null and v_post_author <> v_user then
    insert into public.notifications (user_id, type, payload)
    select
      v_post_author,
      'community',
      jsonb_build_object(
        'title', case when v_is_coach_reply then 'Coach replied' else 'New reply' end,
        'body', left(v_author_name || ': ' || v_body, 180),
        'channelId', v_channel_id,
        'postId', p_post_id,
        'replyId', v_reply.id,
        'postKind', 'announcement',
        'url', '/communities/post/' || p_post_id::text
      )
    where coalesce(public.notification_enabled(v_post_author, 'community'), true);
  end if;

  -- When coach replies, notify thread participants (members who replied).
  if v_is_coach_reply then
    insert into public.notifications (user_id, type, payload)
    select distinct
      cr.user_id,
      'community',
      jsonb_build_object(
        'title', 'Coach replied',
        'body', left(v_author_name || ': ' || v_body, 180),
        'channelId', v_channel_id,
        'postId', p_post_id,
        'replyId', v_reply.id,
        'postKind', 'announcement',
        'url', '/communities/post/' || p_post_id::text
      )
    from public.community_replies cr
    where cr.post_id = p_post_id
      and cr.user_id <> v_user
      and cr.user_id <> v_post_author
      and cr.status = 'visible'
      and cr.deleted_at is null
      and coalesce(public.notification_enabled(cr.user_id, 'community'), true);
  end if;

  return public.get_community_post_thread(p_post_id);
end;
$$;

-- ── Push fanout recipient helper (used by community-push edge function) ───────

create or replace function public.get_community_push_recipients(
  p_post_id uuid default null,
  p_reply_id uuid default null,
  p_exclude_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_post_id uuid;
  v_title text;
  v_body text;
  v_url text;
  v_user_ids uuid[];
begin
  if p_post_id is null and p_reply_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if p_reply_id is not null then
    select
      cp.id,
      cp.channel_id,
      coalesce(n.payload ->> 'title', 'New reply'),
      coalesce(n.payload ->> 'body', left(cr.body, 180)),
      '/communities/post/' || cp.id::text
    into v_post_id, v_channel_id, v_title, v_body, v_url
    from public.community_replies cr
    join public.community_posts cp on cp.id = cr.post_id
    left join lateral (
      select payload
      from public.notifications n
      where n.type = 'community'
        and n.payload ->> 'replyId' = cr.id::text
      order by n.created_at desc
      limit 1
    ) n on true
    where cr.id = p_reply_id
      and cr.status = 'visible'
      and cr.deleted_at is null;
  else
    select
      cp.id,
      cp.channel_id,
      coalesce(nullif(trim(cp.title), ''), 'New announcement'),
      left(cp.body, 180),
      '/communities/post/' || cp.id::text
    into v_post_id, v_channel_id, v_title, v_body, v_url
    from public.community_posts cp
    where cp.id = p_post_id
      and cp.status = 'published'
      and cp.deleted_at is null;
  end if;

  if v_channel_id is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if p_reply_id is not null then
    select array_agg(distinct n.user_id)
      into v_user_ids
    from public.notifications n
    where n.type = 'community'
      and n.payload ->> 'replyId' = p_reply_id::text
      and n.user_id is distinct from p_exclude_user_id;
  else
    select array_agg(distinct cm.user_id)
      into v_user_ids
    from public.community_memberships cm
    where cm.channel_id = v_channel_id
      and cm.joined_at is not null
      and cm.muted_at is null
      and cm.user_id is distinct from p_exclude_user_id
      and coalesce(public.notification_enabled(cm.user_id, 'community'), true);
  end if;

  return jsonb_build_object(
    'userIds', coalesce(to_jsonb(v_user_ids), '[]'::jsonb),
    'title', v_title,
    'body', v_body,
    'channelId', v_channel_id,
    'postId', v_post_id,
    'url', v_url
  );
end;
$$;

revoke execute on function public.get_community_push_recipients(uuid, uuid, uuid) from public, anon;
grant execute on function public.get_community_push_recipients(uuid, uuid, uuid) to service_role;

-- ── Admin channel management ──────────────────────────────────────────────────

create or replace function public.admin_list_community_channels(
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  title text,
  description text,
  status text,
  coach_id uuid,
  coach_name text,
  discipline_id uuid,
  discipline_name text,
  member_count int,
  post_count int,
  latest_post_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select
    ch.id,
    ch.title,
    ch.description,
    ch.status,
    co.id,
    co.name,
    d.id,
    d.display_name,
    coalesce(members.cnt, 0)::int,
    coalesce(posts.cnt, 0)::int,
    latest.published_at,
    ch.created_at
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  join public.disciplines d on d.id = ch.discipline_id
  left join lateral (
    select count(*)::int as cnt
    from public.community_memberships cm
    where cm.channel_id = ch.id and cm.joined_at is not null
  ) members on true
  left join lateral (
    select count(*)::int as cnt
    from public.community_posts cp
    where cp.channel_id = ch.id and cp.deleted_at is null and cp.status = 'published'
  ) posts on true
  left join lateral (
    select cp.published_at
    from public.community_posts cp
    where cp.channel_id = ch.id and cp.deleted_at is null and cp.status = 'published'
    order by cp.published_at desc
    limit 1
  ) latest on true
  where ch.deleted_at is null
  order by coalesce(latest.published_at, ch.created_at) desc
  limit greatest(least(coalesce(p_limit, 50), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_manage_community_channel(
  p_coach_id uuid,
  p_discipline_id uuid,
  p_action text default 'ensure'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.community_channels%rowtype;
  v_action text := lower(trim(coalesce(p_action, 'ensure')));
begin
  perform public.require_admin();

  if p_coach_id is null or p_discipline_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_action = 'ensure' then
    v_row := public.ensure_coach_community_channel(p_coach_id, p_discipline_id);

    insert into public.coach_disciplines (coach_id, discipline_id)
    values (p_coach_id, p_discipline_id)
    on conflict do nothing;

    return jsonb_build_object(
      'id', v_row.id,
      'title', v_row.title,
      'status', v_row.status,
      'action', 'ensure'
    );
  end if;

  select * into v_row
  from public.community_channels
  where coach_id = p_coach_id
    and discipline_id = p_discipline_id
    and deleted_at is null;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_action = 'archive' then
    update public.community_channels
    set status = 'archived', updated_at = now()
    where id = v_row.id
    returning * into v_row;
  elsif v_action = 'restore' then
    update public.community_channels
    set status = 'active', updated_at = now()
    where id = v_row.id
    returning * into v_row;
  elsif v_action = 'delete' then
    update public.community_channels
    set deleted_at = now(), status = 'archived', updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'title', v_row.title,
    'status', v_row.status,
    'action', v_action
  );
end;
$$;

grant execute on function public.admin_list_community_channels(int, int) to authenticated;
grant execute on function public.admin_manage_community_channel(uuid, uuid, text) to authenticated;
