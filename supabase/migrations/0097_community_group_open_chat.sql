-- Group channels become a real flat chat: any member with access can post
-- top-level messages (not just the owning coach), the threaded-reply
-- subsystem is removed entirely, and groups become private-only (no more
-- public discovery/self-join). `community`-kind (per-discipline broadcast)
-- channels are unaffected throughout this migration.

-- ── 1. Permission helper shared by posting checks ──────────────────────────

create or replace function public.can_post_in_community_channel(
  p_channel_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_community_channel(p_channel_id, p_user_id);
$$;

grant execute on function public.can_post_in_community_channel(uuid, uuid) to authenticated;

-- ── 2. Open posting in group channels ───────────────────────────────────────

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
  v_channel public.community_channels%rowtype;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_body text := trim(coalesce(p_body, ''));
  v_post_kind text := coalesce(nullif(trim(coalesce(p_post_kind, '')), ''), 'announcement');
  v_coach_id uuid;
  v_is_coach_author boolean := false;
  v_pin_on_publish boolean := coalesce(p_pin_on_publish, false);
  v_post public.community_posts%rowtype;
begin
  if v_user is null then
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

  if v_channel.status <> 'active' then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_channel.channel_kind = 'community' then
    -- Unchanged: discipline-wide broadcast channels stay coach-authored only.
    v_coach_id := coalesce(p_coach_id, public.coach_id_for_user());

    if v_coach_id is null or not public.is_coach_or_admin() then
      raise exception using message = 'FORBIDDEN', errcode = 'P0001';
    end if;

    if v_channel.coach_id <> v_coach_id then
      raise exception using message = 'FORBIDDEN', errcode = 'P0001';
    end if;

    if not public.coach_has_discipline_access(v_coach_id, v_channel.discipline_id) then
      raise exception using message = 'FORBIDDEN', errcode = 'P0001';
    end if;

    v_is_coach_author := true;
  else
    -- Group channels: the owning coach still posts as "coach"; any other
    -- member with channel access can post a flat chat message.
    v_coach_id := coalesce(p_coach_id, public.coach_id_for_user());
    v_is_coach_author := v_coach_id is not null
      and exists (
        select 1 from public.coaches co
        where co.id = v_channel.coach_id
          and co.id = v_coach_id
          and co.user_id = v_user
      );

    if not v_is_coach_author and not public.can_post_in_community_channel(p_channel_id, v_user) then
      raise exception using message = 'FORBIDDEN', errcode = 'P0001';
    end if;
  end if;

  -- Only the owning coach may pin on publish; members can never self-pin.
  v_pin_on_publish := v_pin_on_publish and v_is_coach_author;

  if v_pin_on_publish then
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
    v_pin_on_publish,
    case when v_pin_on_publish then now() else null end,
    'published',
    now()
  )
  returning * into v_post;

  insert into public.notifications (user_id, type, payload)
  select
    cm.user_id,
    'community',
    jsonb_build_object(
      'title', coalesce(v_title, 'New message'),
      'body', left(v_body, 180),
      'channelId', v_channel.id,
      'postId', v_post.id,
      'postKind', v_post_kind,
      'url', '/communities/' || v_channel.id::text
    )
  from public.community_memberships cm
  where cm.channel_id = v_channel.id
    and cm.user_id <> v_user
    and cm.joined_at is not null
    and cm.muted_at is null
    and (
      exists (select 1 from public.coaches co where co.id = v_channel.coach_id and co.user_id = cm.user_id)
      or public.has_valid_academy_membership(cm.user_id)
    )
    and coalesce(public.notification_enabled(cm.user_id, 'community'), true);

  return v_post;
end;
$$;

-- ── 3. Remove the threaded-reply subsystem ──────────────────────────────────

drop function if exists public.create_community_reply(uuid, text);
drop function if exists public.get_community_post_thread(uuid);

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

  return jsonb_build_object(
    'post', public.community_post_as_json(p_post_id, v_user),
    'reactionToggled', jsonb_build_object('emoji', v_emoji, 'removed', v_removed)
  );
end;
$$;

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
    'authorName', case
      when cp.author_id = co.user_id then coalesce(pr.full_name, 'Coach')
      else coalesce(pr.full_name, 'Member')
    end,
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
  where cp.id = p_post_id
    and cp.status = 'published'
    and cp.deleted_at is null;
$$;

-- Signature changed (dropped p_reply_id) — old 3-arg overload must be
-- dropped explicitly, `create or replace` does not replace it.
drop function if exists public.get_community_push_recipients(uuid, uuid, uuid);

create or replace function public.get_community_push_recipients(
  p_post_id uuid default null,
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
  if p_post_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select
    cp.id,
    cp.channel_id,
    coalesce(nullif(trim(cp.title), ''), 'New message'),
    left(cp.body, 180),
    '/communities/' || cp.channel_id::text
  into v_post_id, v_channel_id, v_title, v_body, v_url
  from public.community_posts cp
  where cp.id = p_post_id
    and cp.status = 'published'
    and cp.deleted_at is null;

  if v_channel_id is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select array_agg(distinct cm.user_id)
    into v_user_ids
  from public.community_memberships cm
  where cm.channel_id = v_channel_id
    and cm.joined_at is not null
    and cm.muted_at is null
    and cm.user_id is distinct from p_exclude_user_id
    and (
      public.has_valid_academy_membership(cm.user_id)
      or exists (
        select 1
        from public.community_channels ch
        join public.coaches co on co.id = ch.coach_id
        where ch.id = v_channel_id
          and co.user_id = cm.user_id
      )
    )
    and coalesce(public.notification_enabled(cm.user_id, 'community'), true);

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

grant execute on function public.get_community_push_recipients(uuid, uuid) to authenticated;

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
  created_at timestamptz,
  post_kind text,
  is_pinned boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select
    'post'::text,
    cp.id,
    cp.channel_id,
    ch.title,
    left(coalesce(cp.title, cp.body), 160),
    cp.status,
    coalesce(pr.full_name, 'Coach'),
    cp.published_at,
    cp.post_kind,
    cp.is_pinned
  from public.community_posts cp
  join public.community_channels ch on ch.id = cp.channel_id
  join public.profiles pr on pr.id = cp.author_id
  where cp.deleted_at is null
    and cp.status in ('published', 'hidden')
  order by cp.published_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.admin_list_community_moderation(int, int) to authenticated;

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

grant execute on function public.admin_moderate_community(text, uuid, text, text) to authenticated;

-- Note: community_moderation_actions.target_type keeps its existing
-- check constraint (still allows 'reply') so historical audit rows stay
-- valid; the app/admin simply never inserts that value again.

-- ── 4. Groups become private-only ───────────────────────────────────────────

create or replace function public.create_community_group(
  p_coach_id uuid,
  p_discipline_id uuid,
  p_title text,
  p_description text default null,
  p_visibility text default 'private',
  p_member_ids uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_coach_id uuid := coalesce(p_coach_id, public.coach_id_for_user());
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_visibility text := 'private';
  v_channel public.community_channels%rowtype;
  v_invalid_count int := 0;
begin
  if v_user is null or v_coach_id is null then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if not public.is_admin()
     and not exists (
      select 1
      from public.coaches co
      where co.id = v_coach_id
        and co.user_id = v_user
        and co.active = true
        and co.deleted_at is null
    ) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if v_title is null or char_length(v_title) > 80 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_description is not null and char_length(v_description) > 240 then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if p_discipline_id is null
     or not exists (select 1 from public.disciplines where id = p_discipline_id and active = true)
     or not public.coach_has_discipline_access(v_coach_id, p_discipline_id) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select count(*)::int
    into v_invalid_count
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as member_id
  ) selected
  where selected.member_id is not null
    and not public.has_valid_academy_membership(selected.member_id);

  if v_invalid_count > 0 then
    raise exception using message = 'INVALID_MEMBERS', errcode = 'P0001';
  end if;

  insert into public.community_channels (
    coach_id,
    discipline_id,
    title,
    description,
    visibility,
    status
  )
  values (
    v_coach_id,
    p_discipline_id,
    v_title,
    v_description,
    v_visibility,
    'active'
  )
  returning * into v_channel;

  insert into public.community_memberships (channel_id, user_id, joined_at)
  values (v_channel.id, v_user, now())
  on conflict (channel_id, user_id) do update
  set joined_at = coalesce(public.community_memberships.joined_at, excluded.joined_at),
      updated_at = now();

  insert into public.community_memberships (channel_id, user_id, invited_at, joined_at)
  select v_channel.id, selected.member_id, now(), now()
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as member_id
  ) selected
  where selected.member_id is not null
    and selected.member_id <> v_user
  on conflict (channel_id, user_id) do update
  set joined_at = now(),
      muted_at = null,
      updated_at = now();

  insert into public.notifications (user_id, type, payload)
  select
    selected.member_id,
    'community',
    jsonb_build_object(
      'title', 'Added to group',
      'body', v_title,
      'channelId', v_channel.id,
      'url', '/communities/' || v_channel.id::text
    )
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as member_id
  ) selected
  where selected.member_id is not null
    and selected.member_id <> v_user
    and coalesce(public.notification_enabled(selected.member_id, 'community'), true);

  return public.community_channel_summary_json(v_channel.id, v_user);
end;
$$;

-- Existing groups that were created public are backfilled to private.
-- Community (discipline-wide) channels are untouched (channel_kind <> 'group').
update public.community_channels
set visibility = 'private', updated_at = now()
where channel_kind = 'group'
  and visibility = 'public'
  and deleted_at is null;

-- Note: `list_discoverable_community_channels` / `join_public_community_channel`
-- are left defined but effectively unreachable for groups now that no group
-- channel can have visibility='public'. `community`-kind channels never route
-- through them (auto-joined via sync_community_memberships), so this is safe
-- to leave as dead code rather than a further schema change.

-- ── 5. Drop the threaded-reply table last ───────────────────────────────────
-- Destructive: this permanently deletes all existing reply/thread data.
-- Confirm before applying against a live project.

do $$
begin
  alter publication supabase_realtime drop table public.community_replies;
exception
  when undefined_table then null;
  when object_not_in_prerequisite_state then null;
end $$;

drop table if exists public.community_replies cascade;
