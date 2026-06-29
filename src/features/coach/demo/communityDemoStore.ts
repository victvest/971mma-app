import { DEMO_COACH, DEMO_COMMUNITY_CHANNELS } from '@/features/coach/demo/coachDemoFixtures';
import type {
  CommunityChannelFeed,
  CommunityChannelHeader,
  CommunityPostItem,
  CommunityPostKind,
  CommunityPostThread,
  CommunityReplyItem,
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
      replyCount: 1,
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
      replyCount: 0,
      myReactions: [],
    },
  ],
};

const DEMO_SEED_REPLIES: Record<string, CommunityReplyItem[]> = {
  'demo-community-post-bjj-1': [
    {
      id: 'demo-community-post-bjj-1-reply-1',
      postId: 'demo-community-post-bjj-1',
      userId: 'demo-member-1',
      authorName: 'Sara Al Mansoori',
      authorAvatarUrl: null,
      body: 'Thanks coach — see you Saturday.',
      createdAt: new Date(Date.now() - 36 * 60 * 60_000).toISOString(),
    },
  ],
};

type DemoChannelStore = {
  posts: CommunityPostItem[];
  repliesByPostId: Record<string, CommunityReplyItem[]>;
};

const stores = new Map<string, DemoChannelStore>();

function clonePost(post: CommunityPostItem): CommunityPostItem {
  return {
    ...post,
    reactionCounts: { ...post.reactionCounts },
    myReactions: [...post.myReactions],
  };
}

function cloneReply(reply: CommunityReplyItem): CommunityReplyItem {
  return { ...reply };
}

function getChannelStore(channelId: string): DemoChannelStore {
  const existing = stores.get(channelId);
  if (existing) return existing;

  const created: DemoChannelStore = {
    posts: (DEMO_SEED_POSTS[channelId] ?? []).map(clonePost),
    repliesByPostId: Object.fromEntries(
      Object.entries(DEMO_SEED_REPLIES)
        .filter(([postId]) => (DEMO_SEED_POSTS[channelId] ?? []).some((post) => post.id === postId))
        .map(([postId, replies]) => [postId, replies.map(cloneReply)]),
    ),
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

function buildThread(post: CommunityPostItem, store: DemoChannelStore): CommunityPostThread {
  return {
    post: clonePost(post),
    replies: (store.repliesByPostId[post.id] ?? []).map(cloneReply),
  };
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

export function getDemoPostThread(postId: string): CommunityPostThread | null {
  const match = findPostInStores(postId);
  if (!match) return null;

  const store = getChannelStore(match.channelId);
  return buildThread(store.posts[match.index]!, store);
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
    replyCount: 0,
    myReactions: [],
  };

  store.posts.unshift(post);
  store.repliesByPostId[post.id] = [];
  return clonePost(post);
}

export function toggleDemoCommunityReaction(postId: string, emoji: string): CommunityPostThread | null {
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
  return buildThread(updated, store);
}

export function createDemoCommunityReply(postId: string, body: string): CommunityPostThread | null {
  const match = findPostInStores(postId);
  if (!match) return null;

  const store = getChannelStore(match.channelId);
  const post = store.posts[match.index]!;
  const reply: CommunityReplyItem = {
    id: `demo-community-reply-${Date.now()}`,
    postId,
    userId: 'demo-member-self',
    authorName: 'You',
    authorAvatarUrl: null,
    body: body.trim(),
    createdAt: new Date().toISOString(),
  };

  const replies = store.repliesByPostId[postId] ?? [];
  store.repliesByPostId[postId] = [...replies, reply];

  const updated: CommunityPostItem = {
    ...post,
    replyCount: post.replyCount + 1,
  };
  store.posts[match.index] = updated;

  return buildThread(updated, store);
}

export function getDemoPinnedPost(channelId: string): CommunityPostItem | null {
  const store = getChannelStore(channelId);
  const pinned = store.posts.find((post) => post.isPinned);
  return pinned ? clonePost(pinned) : null;
}

export function getDemoCommunityChannelHeader(channelId: string): CommunityChannelHeader | null {
  const channel = DEMO_COMMUNITY_CHANNELS.find((item) => item.id === channelId);
  if (!channel) return null;

  return {
    id: channel.id,
    title: channel.title,
    description: channel.description,
    disciplineName: channel.disciplineName,
    disciplineSlug: channel.disciplineSlug,
    coachId: DEMO_COACH.id,
    coachName: channel.coachName,
    coachAvatarUrl: channel.coachAvatarUrl,
    memberCount: channel.memberCount,
    isCoachOwner: channel.isCoachOwner,
    pinnedPost: getDemoPinnedPost(channelId),
  };
}
