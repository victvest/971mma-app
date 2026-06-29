import { sameCommunityDay } from '@/features/communities/components/community-chat-utils';
import type { CommunityPostItem } from '@/types/domain';

export type CommunityFeedRow =
  | { type: 'date'; id: string; iso: string }
  | { type: 'post'; id: string; post: CommunityPostItem };

/** Build chat rows for oldest-first chronological scroll (newest at bottom). */
export function buildCommunityFeedRowsChronological(postsOldestFirst: CommunityPostItem[]): CommunityFeedRow[] {
  const rows: CommunityFeedRow[] = [];

  for (let index = 0; index < postsOldestFirst.length; index += 1) {
    const post = postsOldestFirst[index];
    const previous = index > 0 ? postsOldestFirst[index - 1] : null;

    if (!previous || !sameCommunityDay(previous.publishedAt, post.publishedAt)) {
      rows.push({
        type: 'date',
        id: `date-${post.publishedAt}-${post.id}`,
        iso: post.publishedAt,
      });
    }

    rows.push({ type: 'post', id: post.id, post });
  }

  return rows;
}

export function mergeCommunityFeedPosts(pages: ReadonlyArray<{ posts: CommunityPostItem[] }>): CommunityPostItem[] {
  const seen = new Set<string>();
  const merged: CommunityPostItem[] = [];

  for (const page of pages) {
    for (const post of page.posts) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      merged.push(post);
    }
  }

  return merged;
}
