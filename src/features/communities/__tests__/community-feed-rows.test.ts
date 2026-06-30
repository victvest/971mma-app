import {
  buildCommunityFeedRowsChronological,
  mergeCommunityFeedPosts,
} from '@/features/communities/utils/community-feed-rows';
import type { CommunityPostItem } from '@/types/domain';

function makePost(id: string, publishedAt: string, isUnread = false): CommunityPostItem {
  return {
    id,
    channelId: 'channel-1',
    authorId: 'coach-1',
    authorName: 'Coach',
    authorAvatarUrl: null,
    authorRole: 'coach',
    title: null,
    body: `Message ${id}`,
    mediaUrl: null,
    postKind: 'announcement',
    isPinned: false,
    pinnedAt: null,
    publishedAt,
    reactionCounts: {},
    replyCount: 0,
    myReactions: [],
    isUnread,
  };
}

describe('community-feed-rows', () => {
  it('merges paginated posts without duplicates', () => {
    const merged = mergeCommunityFeedPosts([
      { posts: [makePost('a', '2026-06-29T10:00:00.000Z')] },
      { posts: [makePost('a', '2026-06-29T10:00:00.000Z'), makePost('b', '2026-06-29T11:00:00.000Z')] },
    ]);

    expect(merged.map((post) => post.id)).toEqual(['a', 'b']);
  });

  it('builds chronological rows with date separators', () => {
    const rows = buildCommunityFeedRowsChronological([
      makePost('a', '2026-06-28T10:00:00.000Z'),
      makePost('b', '2026-06-29T10:00:00.000Z'),
      makePost('c', '2026-06-29T11:00:00.000Z'),
    ]);

    expect(rows.filter((row) => row.type === 'date')).toHaveLength(2);
    expect(rows.filter((row) => row.type === 'post').map((row) => row.post.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('preserves unread flag on feed posts', () => {
    const unreadPost = makePost('unread', '2026-06-29T12:00:00.000Z', true);
    const rows = buildCommunityFeedRowsChronological([unreadPost]);
    const postRow = rows.find((row) => row.type === 'post');

    expect(postRow?.type === 'post' && postRow.post.isUnread).toBe(true);
  });
});
