import {
  getDemoCommunityChannelHeader,
  getDemoChannelFeed,
  getDemoPostThread,
  publishDemoCommunityPost,
  toggleDemoCommunityReaction,
  createDemoCommunityReply,
} from '@/features/coach/demo/communityDemoStore';
import {
  getDemoCommunityChannels,
  getDemoCoachCommunityChannels,
  isDemoCommunityChannelId,
} from '@/features/coach/demo/coachDemoFixtures';
import { isCoachDemoMode } from '@/features/coach/demo/coachDemoMode';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import { getSupabaseClient } from '@/services/supabase/client';
import type {
  CommunityAuthorRole,
  CommunityChannelFeed,
  CommunityChannelHeader,
  CommunityChannelItem,
  CommunityFeedCursor,
  CommunityPostItem,
  CommunityPostKind,
  CommunityPostThread,
  CommunityReplyItem,
} from '@/types/domain';

function useDemoCommunityMutation(channelId: string): boolean {
  return isCoachDemoMode() && isDemoCommunityChannelId(channelId);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readPostKind(value: unknown): CommunityPostKind {
  return value === 'system' ? 'system' : 'announcement';
}

function readAuthorRole(value: unknown): CommunityAuthorRole {
  return value === 'member' ? 'member' : 'coach';
}

function mapPost(row: Record<string, unknown>): CommunityPostItem {
  const reactionCounts =
    row.reactionCounts && typeof row.reactionCounts === 'object' && !Array.isArray(row.reactionCounts)
      ? (row.reactionCounts as Record<string, number>)
      : {};

  return {
    id: String(row.id ?? ''),
    channelId: String(row.channelId ?? row.channel_id ?? ''),
    authorId: String(row.authorId ?? row.author_id ?? ''),
    authorName: readString(row.authorName) ?? readString(row.author_name) ?? 'Member',
    authorAvatarUrl: readString(row.authorAvatarUrl) ?? readString(row.author_avatar_url),
    authorRole: readAuthorRole(row.authorRole ?? row.author_role),
    title: readString(row.title),
    body: readString(row.body) ?? '',
    mediaUrl: readString(row.mediaUrl) ?? readString(row.media_url),
    postKind: readPostKind(row.postKind ?? row.post_kind),
    isPinned: readBoolean(row.isPinned ?? row.is_pinned),
    pinnedAt: readString(row.pinnedAt) ?? readString(row.pinned_at),
    publishedAt: String(row.publishedAt ?? row.published_at ?? ''),
    reactionCounts,
    replyCount: readNumber(row.replyCount ?? row.reply_count),
    myReactions: Array.isArray(row.myReactions)
      ? row.myReactions.filter((item): item is string => typeof item === 'string')
      : [],
    isUnread: readBoolean(row.isUnread ?? row.is_unread, false),
  };
}

function mapReply(row: Record<string, unknown>): CommunityReplyItem {
  return {
    id: String(row.id ?? ''),
    postId: String(row.postId ?? row.post_id ?? ''),
    userId: String(row.userId ?? row.user_id ?? ''),
    authorName: readString(row.authorName) ?? readString(row.author_name) ?? 'Member',
    authorAvatarUrl: readString(row.authorAvatarUrl) ?? readString(row.author_avatar_url),
    body: readString(row.body) ?? '',
    createdAt: String(row.createdAt ?? row.created_at ?? ''),
  };
}

function mapChannel(row: Record<string, unknown>): CommunityChannelItem {
  const lastMessageAt =
    readString(row.lastMessageAt) ?? readString(row.last_message_at) ?? readString(row.latestPostAt) ?? readString(row.latest_post_at);

  return {
    id: String(row.id ?? ''),
    title: readString(row.title) ?? 'Community',
    description: readString(row.description),
    disciplineName: readString(row.disciplineName) ?? readString(row.discipline_name) ?? '',
    disciplineSlug: readString(row.disciplineSlug) ?? readString(row.discipline_slug) ?? '',
    coachName: readString(row.coachName) ?? readString(row.coach_name) ?? 'Coach',
    coachAvatarUrl: readString(row.coachAvatarUrl) ?? readString(row.coach_avatar_url),
    latestPostAt: readString(row.latestPostAt) ?? readString(row.latest_post_at),
    lastMessageAt,
    lastMessagePreview: readString(row.lastMessagePreview) ?? readString(row.last_message_preview),
    unreadCount: readNumber(row.unreadCount ?? row.unread_count),
    memberCount: readNumber(row.memberCount ?? row.member_count),
    isCoachOwner: Boolean(row.isCoachOwner ?? row.is_coach_owner),
  };
}

function mapFeedCursor(value: unknown): CommunityFeedCursor | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const publishedAt = readString(row.publishedAt) ?? readString(row.published_at);
  const id = readString(row.id);
  if (!publishedAt || !id) return null;
  return { publishedAt, id };
}

function mapChannelHeader(row: Record<string, unknown>): CommunityChannelHeader {
  const pinnedRaw = row.pinnedPost ?? row.pinned_post;

  return {
    id: String(row.id ?? ''),
    title: readString(row.title) ?? 'Community',
    description: readString(row.description),
    disciplineName: readString(row.disciplineName) ?? readString(row.discipline_name) ?? '',
    disciplineSlug: readString(row.disciplineSlug) ?? readString(row.discipline_slug) ?? '',
    coachId: String(row.coachId ?? row.coach_id ?? ''),
    coachName: readString(row.coachName) ?? readString(row.coach_name) ?? 'Coach',
    coachAvatarUrl: readString(row.coachAvatarUrl) ?? readString(row.coach_avatar_url),
    memberCount: readNumber(row.memberCount ?? row.member_count),
    isCoachOwner: Boolean(row.isCoachOwner ?? row.is_coach_owner),
    pinnedPost:
      pinnedRaw && typeof pinnedRaw === 'object' && !Array.isArray(pinnedRaw)
        ? mapPost(pinnedRaw as Record<string, unknown>)
        : null,
  };
}

export async function listCommunityChannels(): Promise<CommunityChannelItem[]> {
  if (isCoachDemoMode()) {
    return getDemoCommunityChannels();
  }

  const { data, error } = await getSupabaseClient().rpc('list_community_channels');
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return Array.isArray(payload.channels)
    ? payload.channels.map((row) => mapChannel(row as Record<string, unknown>))
    : [];
}

export async function listCoachCommunityChannels(coachId: string): Promise<CommunityChannelItem[]> {
  if (isCoachDemoMode()) {
    return getDemoCoachCommunityChannels();
  }

  const { data, error } = await getSupabaseClient().rpc('list_coach_community_channels', {
    p_coach_id: coachId,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return Array.isArray(payload.channels)
    ? payload.channels.map((row) => mapChannel(row as Record<string, unknown>))
    : [];
}

export async function getCommunityChannelHeader(channelId: string): Promise<CommunityChannelHeader> {
  if (isCoachDemoMode() && isDemoCommunityChannelId(channelId)) {
    const header = getDemoCommunityChannelHeader(channelId);
    if (header) return header;
  }

  const { data, error } = await getSupabaseClient().rpc('get_community_channel_header', {
    p_channel_id: channelId,
  });
  if (error) throw error;

  return mapChannelHeader((data ?? {}) as Record<string, unknown>);
}

export type ListCommunityChannelFeedInput = {
  channelId: string;
  limit?: number;
  cursor?: CommunityFeedCursor | null;
};

export async function listCommunityChannelFeed({
  channelId,
  limit = 25,
  cursor = null,
}: ListCommunityChannelFeedInput): Promise<CommunityChannelFeed> {
  if (isCoachDemoMode() && isDemoCommunityChannelId(channelId)) {
    return getDemoChannelFeed(channelId);
  }

  const { data, error } = await getSupabaseClient().rpc('list_community_channel_feed', {
    p_channel_id: channelId,
    p_limit: limit,
    p_cursor_published_at: cursor?.publishedAt ?? null,
    p_cursor_id: cursor?.id ?? null,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  const pinnedRaw = payload.pinnedPost ?? payload.pinned_post;
  const postsRaw = payload.posts;

  return {
    pinnedPost:
      pinnedRaw && typeof pinnedRaw === 'object' && !Array.isArray(pinnedRaw)
        ? mapPost(pinnedRaw as Record<string, unknown>)
        : null,
    posts: Array.isArray(postsRaw)
      ? postsRaw.map((row) => mapPost(row as Record<string, unknown>))
      : [],
    nextCursor: mapFeedCursor(payload.nextCursor ?? payload.next_cursor),
  };
}

export async function listCommunityChannelPosts(
  channelId: string,
  limit = 20,
  offset = 0,
): Promise<CommunityPostItem[]> {
  const { data, error } = await getSupabaseClient().rpc('list_community_channel_posts', {
    p_channel_id: channelId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return Array.isArray(payload.posts)
    ? payload.posts.map((row) => mapPost(row as Record<string, unknown>))
    : [];
}

export async function getCommunityPostThread(postId: string): Promise<CommunityPostThread> {
  if (isCoachDemoMode()) {
    const demoThread = getDemoPostThread(postId);
    if (demoThread) return demoThread;
  }

  const { data, error } = await getSupabaseClient().rpc('get_community_post_thread', {
    p_post_id: postId,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  const post = mapPost((payload.post ?? {}) as Record<string, unknown>);
  const replies = Array.isArray(payload.replies)
    ? payload.replies.map((row) => mapReply(row as Record<string, unknown>))
    : [];

  return { post, replies };
}

export async function markCommunityChannelRead(channelId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('mark_community_channel_read', {
    p_channel_id: channelId,
  });
  if (error) throw error;
}

export async function fanoutCommunityPush(input: {
  postId?: string;
  replyId?: string;
}): Promise<void> {
  if (isCoachDemoMode()) return;

  try {
    await invokeEdge<{ ok: boolean }>('community-push', input);
  } catch {
    // Push fanout is best-effort; in-app notifications are already persisted.
  }
}

export async function pinCommunityPost(postId: string, coachId?: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('pin_community_post', {
    p_post_id: postId,
    p_coach_id: coachId ?? null,
  });
  if (error) throw error;
}

export async function unpinCommunityPost(postId: string, coachId?: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('unpin_community_post', {
    p_post_id: postId,
    p_coach_id: coachId ?? null,
  });
  if (error) throw error;
}

export async function toggleCommunityReaction(postId: string, emoji: string): Promise<CommunityPostThread> {
  if (isCoachDemoMode()) {
    const demoThread = toggleDemoCommunityReaction(postId, emoji);
    if (demoThread) return demoThread;
  }

  const { data, error } = await getSupabaseClient().rpc('toggle_community_reaction', {
    p_post_id: postId,
    p_emoji: emoji,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    post: mapPost((payload.post ?? {}) as Record<string, unknown>),
    replies: Array.isArray(payload.replies)
      ? payload.replies.map((row) => mapReply(row as Record<string, unknown>))
      : [],
  };
}

export async function createCommunityReply(postId: string, body: string): Promise<CommunityPostThread> {
  if (isCoachDemoMode()) {
    const demoThread = createDemoCommunityReply(postId, body);
    if (demoThread) return demoThread;
  }

  const { data, error } = await getSupabaseClient().rpc('create_community_reply', {
    p_post_id: postId,
    p_body: body,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  const thread = {
    post: mapPost((payload.post ?? {}) as Record<string, unknown>),
    replies: Array.isArray(payload.replies)
      ? payload.replies.map((row) => mapReply(row as Record<string, unknown>))
      : [],
  };

  const latestReply = thread.replies.at(-1);
  if (latestReply?.id) {
    void fanoutCommunityPush({ replyId: latestReply.id });
  }

  return thread;
}

export async function publishCommunityPost(input: {
  channelId: string;
  coachId: string;
  title?: string | null;
  body: string;
  postKind?: CommunityPostKind;
  pinOnPublish?: boolean;
}): Promise<string | null> {
  if (useDemoCommunityMutation(input.channelId)) {
    publishDemoCommunityPost({
      channelId: input.channelId,
      body: input.body,
      title: input.title,
      postKind: input.postKind,
      pinOnPublish: input.pinOnPublish,
    });
    return null;
  }

  const { data, error } = await getSupabaseClient().rpc('publish_community_post', {
    p_channel_id: input.channelId,
    p_title: input.title ?? null,
    p_body: input.body,
    p_coach_id: input.coachId,
    p_post_kind: input.postKind ?? 'announcement',
    p_pin_on_publish: input.pinOnPublish ?? false,
  });
  if (error) throw error;

  const row = (data ?? {}) as Record<string, unknown>;
  const postId = typeof row.id === 'string' ? row.id : null;
  if (postId) {
    void fanoutCommunityPush({ postId });
  }
  return postId;
}
