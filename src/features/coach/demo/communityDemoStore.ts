import {
  DEMO_COACH,
  DEMO_COACH_ASSIGNED_DISCIPLINES,
  DEMO_COMMUNITY_CHANNELS,
  DEMO_PROMOTION_CANDIDATES,
} from '@/features/coach/demo/coachDemoFixtures';
import type {
  CommunityChannelFeed,
  CommunityChannelHeader,
  CommunityChannelItem,
  CommunityGroupDiscipline,
  CommunityGroupMember,
  CommunityGroupMemberCandidate,
  CommunityGroupVisibility,
  CommunityPostItem,
  CommunityPostKind,
} from '@/types/domain';

const DEMO_SEED_POSTS: Record<string, CommunityPostItem[]> = {
  'demo-community-channel-bjj': [
    {
      id: 'demo-community-post-bjj-1',
      channelId: 'demo-community-channel-bjj',
      authorId: DEMO_COACH.id,
      authorName: DEMO_COACH.name,
      authorAvatarUrl: DEMO_COACH.photoUrl,
      authorRole: 'coach',
      title: 'Open mat this Saturday',
      body: 'Open mat this Saturday from 10:00 — bring your gi. We will focus on passing sequences and Q&A after rolls.',
      mediaUrl: null,
      postKind: 'announcement',
      isPinned: true,
      pinnedAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
      reactionCounts: { '👍': 12, '🔥': 5 },
      myReactions: [],
    },
    {
      id: 'demo-community-post-bjj-2',
      channelId: 'demo-community-channel-bjj',
      authorId: DEMO_COACH.id,
      authorName: DEMO_COACH.name,
      authorAvatarUrl: DEMO_COACH.photoUrl,
      authorRole: 'coach',
      title: 'Competition prep cycle',
      body: 'Competition prep cycle starts Monday. Reply in the thread if you want mat time before class.',
      mediaUrl: null,
      postKind: 'announcement',
      isPinned: false,
      pinnedAt: null,
      publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60_000).toISOString(),
      reactionCounts: { '💪': 8 },
      myReactions: [],
    },
  ],
};

type DemoChannelStore = {
  posts: CommunityPostItem[];
};

const stores = new Map<string, DemoChannelStore>();

const demoGroupMembers = new Map<string, CommunityGroupMember[]>();

function clonePost(post: CommunityPostItem): CommunityPostItem {
  return {
    ...post,
    reactionCounts: { ...post.reactionCounts },
    myReactions: [...post.myReactions],
  };
}

function getChannelStore(channelId: string): DemoChannelStore {
  const existing = stores.get(channelId);
  if (existing) return existing;

  const created: DemoChannelStore = {
    posts: (DEMO_SEED_POSTS[channelId] ?? []).map(clonePost),
  };
  stores.set(channelId, created);
  return created;
}

function findPostInStores(postId: string): { channelId: string; post: CommunityPostItem; index: number } | null {
  for (const [channelId, store] of stores.entries()) {
    const index = store.posts.findIndex((post) => post.id === postId);
    if (index >= 0) {
      return { channelId, post: store.posts[index]!, index };
    }
  }

  for (const channelId of Object.keys(DEMO_SEED_POSTS)) {
    getChannelStore(channelId);
  }

  for (const [channelId, store] of stores.entries()) {
    const index = store.posts.findIndex((post) => post.id === postId);
    if (index >= 0) {
      return { channelId, post: store.posts[index]!, index };
    }
  }

  return null;
}

export function getDemoChannelFeed(channelId: string): CommunityChannelFeed {
  const store = getChannelStore(channelId);
  const posts = [...store.posts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return {
    pinnedPost: posts.find((post) => post.isPinned) ?? null,
    posts: posts.map(clonePost),
    nextCursor: null,
  };
}

export function publishDemoCommunityPost(input: {
  channelId: string;
  body: string;
  title?: string | null;
  postKind?: CommunityPostKind;
  pinOnPublish?: boolean;
}): CommunityPostItem {
  const store = getChannelStore(input.channelId);
  const now = new Date().toISOString();

  if (input.pinOnPublish) {
    store.posts = store.posts.map((post) =>
      post.isPinned ? { ...post, isPinned: false, pinnedAt: null } : post,
    );
  }

  const post: CommunityPostItem = {
    id: `demo-community-post-${Date.now()}`,
    channelId: input.channelId,
    authorId: DEMO_COACH.id,
    authorName: DEMO_COACH.name,
    authorAvatarUrl: DEMO_COACH.photoUrl,
    authorRole: 'coach',
    title: input.title?.trim() || null,
    body: input.body.trim(),
    mediaUrl: null,
    postKind: input.postKind ?? 'announcement',
    isPinned: input.pinOnPublish ?? false,
    pinnedAt: input.pinOnPublish ? now : null,
    publishedAt: now,
    reactionCounts: {},
    myReactions: [],
  };

  store.posts.unshift(post);
  return clonePost(post);
}

export function toggleDemoCommunityReaction(postId: string, emoji: string): CommunityPostItem | null {
  const match = findPostInStores(postId);
  if (!match) return null;

  const store = getChannelStore(match.channelId);
  const post = store.posts[match.index]!;
  const counts = { ...post.reactionCounts };
  const mine = [...post.myReactions];
  const activeIndex = mine.indexOf(emoji);

  if (activeIndex >= 0) {
    mine.splice(activeIndex, 1);
    const next = Math.max(0, (counts[emoji] ?? 0) - 1);
    if (next === 0) {
      delete counts[emoji];
    } else {
      counts[emoji] = next;
    }
  } else {
    mine.push(emoji);
    counts[emoji] = (counts[emoji] ?? 0) + 1;
  }

  const updated: CommunityPostItem = {
    ...post,
    reactionCounts: counts,
    myReactions: mine,
  };
  store.posts[match.index] = updated;
  return clonePost(updated);
}

export function getDemoPinnedPost(channelId: string): CommunityPostItem | null {
  const store = getChannelStore(channelId);
  const pinned = store.posts.find((post) => post.isPinned);
  return pinned ? clonePost(pinned) : null;
}

function buildDemoMember(candidate: (typeof DEMO_PROMOTION_CANDIDATES)[number]): CommunityGroupMember {
  return {
    id: candidate.userId,
    fullName: candidate.fullName,
    email: candidate.email,
    avatarUrl: candidate.avatarUrl,
    membershipStatus: 'active',
    membershipExpiresAt: null,
    joinedAt: new Date().toISOString(),
    isCoach: false,
  };
}

function getMembersStore(channelId: string): CommunityGroupMember[] {
  const existing = demoGroupMembers.get(channelId);
  if (existing) return existing;

  const seeded: CommunityGroupMember[] = [
    {
      id: DEMO_COACH.id,
      fullName: DEMO_COACH.name,
      email: null,
      avatarUrl: DEMO_COACH.photoUrl,
      membershipStatus: 'active',
      membershipExpiresAt: null,
      joinedAt: new Date(Date.now() - 45 * 24 * 60 * 60_000).toISOString(),
      isCoach: true,
    },
    ...DEMO_PROMOTION_CANDIDATES.slice(0, 3).map(buildDemoMember),
  ];

  demoGroupMembers.set(channelId, seeded);
  return seeded;
}

export function getDemoCoachGroupDisciplines(): CommunityGroupDiscipline[] {
  return DEMO_COACH_ASSIGNED_DISCIPLINES.map((item) => ({
    id: item.id,
    name: item.displayName,
    slug: item.slug,
  }));
}

export function joinDemoCommunityGroup(channelId: string): CommunityChannelItem {
  const channel = DEMO_COMMUNITY_CHANNELS.find((item) => item.id === channelId);
  if (!channel) throw new Error('Group not found.');

  channel.joinedAt = new Date().toISOString();
  channel.canJoin = false;
  channel.memberCount += 1;
  return { ...channel };
}

export function leaveDemoCommunityGroup(channelId: string): void {
  const channel = DEMO_COMMUNITY_CHANNELS.find((item) => item.id === channelId);
  if (!channel) return;

  channel.joinedAt = null;
  channel.canJoin = channel.visibility === 'public';
  channel.memberCount = Math.max(0, channel.memberCount - 1);
}

export function createDemoCommunityGroup(input: {
  disciplineId: string;
  title: string;
  description?: string | null;
  visibility?: CommunityGroupVisibility;
  memberIds?: string[];
}): CommunityChannelItem {
  const discipline =
    DEMO_COACH_ASSIGNED_DISCIPLINES.find((item) => item.id === input.disciplineId) ??
    DEMO_COACH_ASSIGNED_DISCIPLINES[0]!;
  const now = new Date().toISOString();
  const selected = new Set(input.memberIds ?? []);
  const members = [
    {
      id: DEMO_COACH.id,
      fullName: DEMO_COACH.name,
      email: null,
      avatarUrl: DEMO_COACH.photoUrl,
      membershipStatus: 'active',
      membershipExpiresAt: null,
      joinedAt: now,
      isCoach: true,
    } satisfies CommunityGroupMember,
    ...DEMO_PROMOTION_CANDIDATES.filter((candidate) => selected.has(candidate.userId)).map(buildDemoMember),
  ];

  const channel: CommunityChannelItem = {
    id: `demo-community-channel-${Date.now()}`,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    visibility: 'private',
    channelKind: 'group',
    disciplineId: discipline.id,
    disciplineName: discipline.displayName,
    disciplineSlug: discipline.slug,
    coachId: DEMO_COACH.id,
    coachName: DEMO_COACH.name,
    coachAvatarUrl: DEMO_COACH.photoUrl,
    latestPostAt: null,
    lastMessageAt: null,
    lastMessagePreview: null,
    unreadCount: 0,
    memberCount: members.length,
    isCoachOwner: true,
    joinedAt: now,
    canJoin: false,
  };

  DEMO_COMMUNITY_CHANNELS.unshift(channel);
  demoGroupMembers.set(channel.id, members);
  stores.set(channel.id, { posts: [] });
  return { ...channel };
}

export function archiveDemoCommunityGroup(channelId: string): void {
  const index = DEMO_COMMUNITY_CHANNELS.findIndex((item) => item.id === channelId);
  if (index >= 0) {
    DEMO_COMMUNITY_CHANNELS.splice(index, 1);
  }
}

export function getDemoCommunityGroupMembers(channelId: string): CommunityGroupMember[] {
  return getMembersStore(channelId).map((item) => ({ ...item }));
}

export function getDemoCommunityGroupMemberCandidates(
  query: string,
): CommunityGroupMemberCandidate[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length > 0 && normalized.length < 2) return [];

  return DEMO_PROMOTION_CANDIDATES.filter(
    (item) =>
      !normalized ||
      item.fullName.toLowerCase().includes(normalized) ||
      item.email.toLowerCase().includes(normalized),
  ).map((item) => ({
    id: item.userId,
    fullName: item.fullName,
    email: item.email,
    avatarUrl: item.avatarUrl,
    membershipStatus: 'active',
    membershipExpiresAt: null,
  }));
}

export function addDemoCommunityGroupMembers(
  channelId: string,
  memberIds: string[],
): CommunityGroupMember[] {
  const members = getMembersStore(channelId);
  const existingIds = new Set(members.map((item) => item.id));
  const nextMembers = DEMO_PROMOTION_CANDIDATES.filter(
    (candidate) => memberIds.includes(candidate.userId) && !existingIds.has(candidate.userId),
  ).map(buildDemoMember);

  members.push(...nextMembers);
  const channel = DEMO_COMMUNITY_CHANNELS.find((item) => item.id === channelId);
  if (channel) channel.memberCount = members.length;
  return members.map((item) => ({ ...item }));
}

export function removeDemoCommunityGroupMember(
  channelId: string,
  memberId: string,
): CommunityGroupMember[] {
  const members = getMembersStore(channelId);
  const next = members.filter((item) => item.id !== memberId || item.isCoach);
  demoGroupMembers.set(channelId, next);
  const channel = DEMO_COMMUNITY_CHANNELS.find((item) => item.id === channelId);
  if (channel) channel.memberCount = next.length;
  return next.map((item) => ({ ...item }));
}

export function getDemoCommunityChannelHeader(channelId: string): CommunityChannelHeader | null {
  const channel = DEMO_COMMUNITY_CHANNELS.find((item) => item.id === channelId);
  if (!channel) return null;

  return {
    id: channel.id,
    title: channel.title,
    description: channel.description,
    visibility: channel.visibility,
    channelKind: channel.channelKind,
    disciplineId: channel.disciplineId,
    disciplineName: channel.disciplineName,
    disciplineSlug: channel.disciplineSlug,
    coachId: channel.coachId,
    coachName: channel.coachName,
    coachAvatarUrl: channel.coachAvatarUrl,
    memberCount: channel.memberCount,
    isCoachOwner: channel.isCoachOwner,
    joinedAt: channel.joinedAt,
    canJoin: channel.canJoin,
    pinnedPost: getDemoPinnedPost(channelId),
  };
}
