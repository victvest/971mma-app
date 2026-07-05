import {
  addDemoCommunityGroupMembers,
  archiveDemoCommunityGroup,
  createDemoCommunityGroup,
  getDemoCommunityChannelHeader,
  getDemoChannelFeed,
  getDemoCommunityGroupMembers,
  getDemoCommunityGroupMemberCandidates,
  getDemoCoachGroupDisciplines,
  joinDemoCommunityGroup,
  leaveDemoCommunityGroup,
  publishDemoCommunityPost,
  removeDemoCommunityGroupMember,
  toggleDemoCommunityReaction,
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
  CommunityChannelKind,
  CommunityChannelItem,
  CommunityFeedCursor,
  CommunityGroupDiscipline,
  CommunityGroupMember,
  CommunityGroupMemberCandidate,
  CommunityGroupVisibility,
  CommunityPostItem,
  CommunityPostKind,
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

function readVisibility(value: unknown): CommunityGroupVisibility {
  return value === 'private' ? 'private' : 'public';
}

function readChannelKind(value: unknown): CommunityChannelKind {
  return value === 'community' ? 'community' : 'group';
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
    myReactions: Array.isArray(row.myReactions)
      ? row.myReactions.filter((item): item is string => typeof item === 'string')
      : [],
    isUnread: readBoolean(row.isUnread ?? row.is_unread, false),
  };
}

function mapChannel(row: Record<string, unknown>): CommunityChannelItem {
  const lastMessageAt =
    readString(row.lastMessageAt) ?? readString(row.last_message_at) ?? readString(row.latestPostAt) ?? readString(row.latest_post_at);

  return {
    id: String(row.id ?? ''),
    title: readString(row.title) ?? 'Community',
    description: readString(row.description),
    visibility: readVisibility(row.visibility),
    channelKind: readChannelKind(row.channelKind ?? row.channel_kind),
    disciplineId: String(row.disciplineId ?? row.discipline_id ?? ''),
    disciplineName: readString(row.disciplineName) ?? readString(row.discipline_name) ?? '',
    disciplineSlug: readString(row.disciplineSlug) ?? readString(row.discipline_slug) ?? '',
    coachId: String(row.coachId ?? row.coach_id ?? ''),
    coachName: readString(row.coachName) ?? readString(row.coach_name) ?? 'Coach',
    coachAvatarUrl: readString(row.coachAvatarUrl) ?? readString(row.coach_avatar_url),
    latestPostAt: readString(row.latestPostAt) ?? readString(row.latest_post_at),
    lastMessageAt,
    lastMessagePreview: readString(row.lastMessagePreview) ?? readString(row.last_message_preview),
    unreadCount: readNumber(row.unreadCount ?? row.unread_count),
    memberCount: readNumber(row.memberCount ?? row.member_count),
    isCoachOwner: readBoolean(row.isCoachOwner ?? row.is_coach_owner),
    joinedAt: readString(row.joinedAt) ?? readString(row.joined_at),
    canJoin: readBoolean(row.canJoin ?? row.can_join),
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
    visibility: readVisibility(row.visibility),
    channelKind: readChannelKind(row.channelKind ?? row.channel_kind),
    disciplineId: String(row.disciplineId ?? row.discipline_id ?? ''),
    disciplineName: readString(row.disciplineName) ?? readString(row.discipline_name) ?? '',
    disciplineSlug: readString(row.disciplineSlug) ?? readString(row.discipline_slug) ?? '',
    coachId: String(row.coachId ?? row.coach_id ?? ''),
    coachName: readString(row.coachName) ?? readString(row.coach_name) ?? 'Coach',
    coachAvatarUrl: readString(row.coachAvatarUrl) ?? readString(row.coach_avatar_url),
    memberCount: readNumber(row.memberCount ?? row.member_count),
    isCoachOwner: readBoolean(row.isCoachOwner ?? row.is_coach_owner),
    joinedAt: readString(row.joinedAt) ?? readString(row.joined_at),
    canJoin: readBoolean(row.canJoin ?? row.can_join),
    pinnedPost:
      pinnedRaw && typeof pinnedRaw === 'object' && !Array.isArray(pinnedRaw)
        ? mapPost(pinnedRaw as Record<string, unknown>)
        : null,
  };
}

function mapDiscipline(row: Record<string, unknown>): CommunityGroupDiscipline {
  return {
    id: String(row.id ?? ''),
    name: readString(row.name) ?? readString(row.displayName) ?? readString(row.display_name) ?? 'Discipline',
    slug: readString(row.slug) ?? '',
  };
}

function mapGroupMember(row: Record<string, unknown>): CommunityGroupMember {
  return {
    id: String(row.id ?? ''),
    fullName: readString(row.fullName) ?? readString(row.full_name) ?? 'Member',
    email: readString(row.email),
    avatarUrl: readString(row.avatarUrl) ?? readString(row.avatar_url),
    membershipStatus: readString(row.membershipStatus) ?? readString(row.membership_status),
    membershipExpiresAt:
      readString(row.membershipExpiresAt) ?? readString(row.membership_expires_at),
    joinedAt: readString(row.joinedAt) ?? readString(row.joined_at),
    isCoach: readBoolean(row.isCoach ?? row.is_coach),
  };
}

function mapGroupMemberCandidate(row: Record<string, unknown>): CommunityGroupMemberCandidate {
  const member = mapGroupMember(row);
  return {
    id: member.id,
    fullName: member.fullName,
    email: member.email,
    avatarUrl: member.avatarUrl,
    membershipStatus: member.membershipStatus,
    membershipExpiresAt: member.membershipExpiresAt,
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

export async function listDiscoverableCommunityChannels(): Promise<CommunityChannelItem[]> {
  if (isCoachDemoMode()) {
    return [];
  }

  const { data, error } = await getSupabaseClient().rpc('list_discoverable_community_channels');
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return Array.isArray(payload.channels)
    ? payload.channels.map((row) => mapChannel(row as Record<string, unknown>))
    : [];
}

export async function listCoachCommunityChannels(coachId: string): Promise<CommunityChannelItem[]> {
  if (isCoachDemoMode()) {
    return getDemoCoachCommunityChannels().filter((channel) => channel.channelKind === 'group');
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

export async function listCoachCommunityAnnouncementChannels(
  coachId: string,
): Promise<CommunityChannelItem[]> {
  if (isCoachDemoMode()) {
    return getDemoCoachCommunityChannels().filter((channel) => channel.channelKind === 'community');
  }

  const { data, error } = await getSupabaseClient().rpc(
    'list_coach_community_announcement_channels',
    {
      p_coach_id: coachId,
    },
  );
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return Array.isArray(payload.channels)
    ? payload.channels.map((row) => mapChannel(row as Record<string, unknown>))
    : [];
}

export async function joinPublicCommunityChannel(channelId: string): Promise<CommunityChannelItem> {
  if (isCoachDemoMode() && isDemoCommunityChannelId(channelId)) {
    return joinDemoCommunityGroup(channelId);
  }

  const { data, error } = await getSupabaseClient().rpc('join_public_community_channel', {
    p_channel_id: channelId,
  });
  if (error) throw error;

  return mapChannel((data ?? {}) as Record<string, unknown>);
}

export async function leaveCommunityChannel(channelId: string): Promise<void> {
  if (isCoachDemoMode() && isDemoCommunityChannelId(channelId)) {
    leaveDemoCommunityGroup(channelId);
    return;
  }

  const { error } = await getSupabaseClient().rpc('leave_community_channel', {
    p_channel_id: channelId,
  });
  if (error) throw error;
}

export async function listCoachGroupDisciplines(coachId: string): Promise<CommunityGroupDiscipline[]> {
  if (isCoachDemoMode()) {
    return getDemoCoachGroupDisciplines();
  }

  const { data, error } = await getSupabaseClient().rpc('list_coach_group_disciplines', {
    p_coach_id: coachId,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return Array.isArray(payload.disciplines)
    ? payload.disciplines.map((row) => mapDiscipline(row as Record<string, unknown>))
    : [];
}

export async function createCommunityGroup(input: {
  coachId: string;
  disciplineId: string;
  title: string;
  description?: string | null;
  memberIds?: string[];
}): Promise<CommunityChannelItem> {
  if (isCoachDemoMode()) {
    return createDemoCommunityGroup(input);
  }

  const { data, error } = await getSupabaseClient().rpc('create_community_group', {
    p_coach_id: input.coachId,
    p_discipline_id: input.disciplineId,
    p_title: input.title,
    p_description: input.description ?? null,
    p_visibility: 'private',
    p_member_ids: input.memberIds ?? [],
  });
  if (error) throw error;

  return mapChannel((data ?? {}) as Record<string, unknown>);
}

export async function updateCommunityGroup(input: {
  channelId: string;
  coachId: string;
  title?: string | null;
  description?: string | null;
  visibility?: CommunityGroupVisibility | null;
}): Promise<CommunityChannelItem> {
  const { data, error } = await getSupabaseClient().rpc('update_community_group', {
    p_channel_id: input.channelId,
    p_coach_id: input.coachId,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_visibility: input.visibility ?? null,
  });
  if (error) throw error;

  return mapChannel((data ?? {}) as Record<string, unknown>);
}

export async function archiveCommunityGroup(input: {
  channelId: string;
  coachId: string;
}): Promise<void> {
  if (isCoachDemoMode() && isDemoCommunityChannelId(input.channelId)) {
    archiveDemoCommunityGroup(input.channelId);
    return;
  }

  const { error } = await getSupabaseClient().rpc('archive_community_group', {
    p_channel_id: input.channelId,
    p_coach_id: input.coachId,
  });
  if (error) throw error;
}

export async function listCommunityGroupMembers(
  channelId: string,
  coachId: string,
): Promise<CommunityGroupMember[]> {
  if (isCoachDemoMode() && isDemoCommunityChannelId(channelId)) {
    return getDemoCommunityGroupMembers(channelId);
  }

  const { data, error } = await getSupabaseClient().rpc('list_community_group_members', {
    p_channel_id: channelId,
    p_coach_id: coachId,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return Array.isArray(payload.members)
    ? payload.members.map((row) => mapGroupMember(row as Record<string, unknown>))
    : [];
}

export async function searchCommunityGroupMemberCandidates(input: {
  channelId: string;
  coachId: string;
  query: string;
}): Promise<CommunityGroupMemberCandidate[]> {
  if (isCoachDemoMode() && isDemoCommunityChannelId(input.channelId)) {
    return getDemoCommunityGroupMemberCandidates(input.query);
  }

  const { data, error } = await getSupabaseClient().rpc('search_community_group_member_candidates', {
    p_channel_id: input.channelId,
    p_query: input.query,
    p_limit: 20,
    p_coach_id: input.coachId,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return Array.isArray(payload.members)
    ? payload.members.map((row) => mapGroupMemberCandidate(row as Record<string, unknown>))
    : [];
}

export async function searchCommunityMemberCandidates(input: {
  coachId: string;
  query: string;
}): Promise<CommunityGroupMemberCandidate[]> {
  if (isCoachDemoMode()) {
    return getDemoCommunityGroupMemberCandidates(input.query);
  }

  const { data, error } = await getSupabaseClient().rpc('search_community_member_candidates', {
    p_query: input.query,
    p_limit: 20,
    p_coach_id: input.coachId,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return Array.isArray(payload.members)
    ? payload.members.map((row) => mapGroupMemberCandidate(row as Record<string, unknown>))
    : [];
}

export async function addCommunityGroupMembers(input: {
  channelId: string;
  coachId: string;
  memberIds: string[];
}): Promise<CommunityGroupMember[]> {
  if (isCoachDemoMode() && isDemoCommunityChannelId(input.channelId)) {
    return addDemoCommunityGroupMembers(input.channelId, input.memberIds);
  }

  const { data, error } = await getSupabaseClient().rpc('add_community_group_members', {
    p_channel_id: input.channelId,
    p_member_ids: input.memberIds,
    p_coach_id: input.coachId,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return Array.isArray(payload.members)
    ? payload.members.map((row) => mapGroupMember(row as Record<string, unknown>))
    : [];
}

export async function removeCommunityGroupMember(input: {
  channelId: string;
  coachId: string;
  memberId: string;
}): Promise<CommunityGroupMember[]> {
  if (isCoachDemoMode() && isDemoCommunityChannelId(input.channelId)) {
    return removeDemoCommunityGroupMember(input.channelId, input.memberId);
  }

  const { data, error } = await getSupabaseClient().rpc('remove_community_group_member', {
    p_channel_id: input.channelId,
    p_member_id: input.memberId,
    p_coach_id: input.coachId,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return Array.isArray(payload.members)
    ? payload.members.map((row) => mapGroupMember(row as Record<string, unknown>))
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

export async function resolveCommunityPostChannelId(postId: string): Promise<string | null> {
  if (isCoachDemoMode()) return null;

  const { data, error } = await getSupabaseClient()
    .from('community_posts')
    .select('channel_id')
    .eq('id', postId)
    .maybeSingle();
  if (error) throw error;

  return readString((data as Record<string, unknown> | null)?.channel_id);
}

export async function markCommunityChannelRead(channelId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('mark_community_channel_read', {
    p_channel_id: channelId,
  });
  if (error) throw error;
}

export async function fanoutCommunityPush(input: { postId?: string }): Promise<void> {
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

export async function toggleCommunityReaction(postId: string, emoji: string): Promise<CommunityPostItem> {
  if (isCoachDemoMode()) {
    const demoPost = toggleDemoCommunityReaction(postId, emoji);
    if (demoPost) return demoPost;
  }

  const { data, error } = await getSupabaseClient().rpc('toggle_community_reaction', {
    p_post_id: postId,
    p_emoji: emoji,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return mapPost((payload.post ?? {}) as Record<string, unknown>);
}

export async function publishCommunityPost(input: {
  channelId: string;
  coachId?: string;
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
    p_coach_id: input.coachId ?? null,
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
