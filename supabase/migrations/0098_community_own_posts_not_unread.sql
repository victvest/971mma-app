-- A member's own messages must never count as "unread" for themselves. The
-- unread checks previously only compared published_at to last_read_at, with
-- no author exclusion — harmless when only coaches posted (they read their
-- own channel immediately after), but now that any member can post in group
-- channels, sending a message and leaving the screen showed a "new message"
-- badge/chip for the sender's own post.

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
    'isUnread', cp.author_id <> p_viewer_id
      and case
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

create or replace function public.community_channel_summary_json(
  p_channel_id uuid,
  p_viewer_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', ch.id,
    'title', ch.title,
    'description', ch.description,
    'visibility', ch.visibility,
    'channelKind', ch.channel_kind,
    'disciplineId', d.id,
    'disciplineName', d.display_name,
    'disciplineSlug', d.slug,
    'coachId', co.id,
    'coachName', co.name,
    'coachAvatarUrl', p.avatar_url,
    'latestPostAt', latest.published_at,
    'lastMessageAt', latest.published_at,
    'lastMessagePreview', latest.preview,
    'unreadCount', coalesce(unread.cnt, 0),
    'memberCount', member_counts.cnt,
    'isCoachOwner', co.user_id = p_viewer_id,
    'joinedAt', cm.joined_at,
    'canJoin', ch.channel_kind = 'group'
      and ch.visibility = 'public'
      and cm.joined_at is null
      and public.member_can_discover_discipline(p_viewer_id, ch.discipline_id)
  )
  from public.community_channels ch
  join public.coaches co on co.id = ch.coach_id
  join public.disciplines d on d.id = ch.discipline_id
  left join public.profiles p on p.id = co.user_id
  left join public.community_memberships cm
    on cm.channel_id = ch.id
   and cm.user_id = p_viewer_id
  left join lateral (
    select
      cp.published_at,
      left(coalesce(nullif(trim(cp.title), ''), cp.body), 120) as preview
    from public.community_posts cp
    where cp.channel_id = ch.id
      and cp.status = 'published'
      and cp.deleted_at is null
    order by cp.published_at desc
    limit 1
  ) latest on true
  left join lateral (
    select count(*)::int as cnt
    from public.community_posts cp_unread
    where cp_unread.channel_id = ch.id
      and cp_unread.status = 'published'
      and cp_unread.deleted_at is null
      and cp_unread.author_id <> p_viewer_id
      and cp_unread.published_at > coalesce(cm.last_read_at, cm.joined_at, '-infinity'::timestamptz)
  ) unread on true
  left join lateral (
    select count(*)::int as cnt
    from public.community_memberships cm2
    where cm2.channel_id = ch.id
      and cm2.joined_at is not null
  ) member_counts on true
  where ch.id = p_channel_id
    and ch.deleted_at is null;
$$;
