import { getSupabaseClient } from '@/services/supabase/client';
import { FEED_PAGE_SIZE } from '@/features/feed/constants';
import type {
  FeedComment,
  FeedCommentsPage,
  FeedCursor,
  FeedDiscipline,
  FeedMediaItem,
  FeedPost,
  FeedPostsPage,
  FeedProfilePage,
  FeedSearchPage,
  FeedSearchType,
} from '@/features/feed/types';
import { coerceNumber, coerceString } from '@/features/feed/utils/feedFormat';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function mapMedia(value: unknown): FeedMediaItem[] {
  const media: FeedMediaItem[] = [];
  for (const item of asArray(value)) {
    const row = asRecord(item);
    const url = asStringOrNull(row.url);
    if (!url) continue;
    media.push({
      id: asStringOrNull(row.id) ?? url,
      type: 'image',
      url,
      path: asStringOrNull(row.path),
      width: typeof row.width === 'number' ? row.width : null,
      height: typeof row.height === 'number' ? row.height : null,
    });
  }
  return media;
}

export function mapFeedDiscipline(value: unknown): FeedDiscipline {
  const row = asRecord(value);
  return {
    id: coerceString(row.id),
    slug: coerceString(row.slug),
    displayName: coerceString(row.displayName, 'Discipline'),
    hasRankProgression: row.hasRankProgression === true,
    isMemberDiscipline: row.isMemberDiscipline === true,
  };
}

export function mapFeedPost(value: unknown): FeedPost {
  const row = asRecord(value);
  return {
    id: coerceString(row.id),
    authorId: coerceString(row.authorId),
    authorName: coerceString(row.authorName, 'Member'),
    authorAvatarUrl: asStringOrNull(row.authorAvatarUrl),
    authorBio: asStringOrNull(row.authorBio),
    authorRole: asStringOrNull(row.authorRole),
    isVerifiedCoach: row.isVerifiedCoach === true,
    disciplineId: coerceString(row.disciplineId),
    disciplineName: coerceString(row.disciplineName, 'Training'),
    disciplineSlug: coerceString(row.disciplineSlug),
    body: coerceString(row.body),
    media: mapMedia(row.media),
    likeCount: coerceNumber(row.likeCount),
    commentCount: coerceNumber(row.commentCount),
    shareCount: coerceNumber(row.shareCount),
    myLiked: row.myLiked === true,
    canDelete: row.canDelete === true,
    publishedAt: coerceString(row.publishedAt, new Date().toISOString()),
    createdAt: coerceString(row.createdAt, coerceString(row.publishedAt, new Date().toISOString())),
  };
}

export function mapFeedComment(value: unknown): FeedComment {
  const row = asRecord(value);
  return {
    id: coerceString(row.id),
    postId: coerceString(row.postId),
    authorId: coerceString(row.authorId),
    authorName: coerceString(row.authorName, 'Member'),
    authorAvatarUrl: asStringOrNull(row.authorAvatarUrl),
    authorRole: asStringOrNull(row.authorRole),
    isVerifiedCoach: row.isVerifiedCoach === true,
    body: coerceString(row.body),
    canDelete: row.canDelete === true,
    createdAt: coerceString(row.createdAt, new Date().toISOString()),
  };
}

function mapCursor(row: Record<string, unknown>): FeedCursor {
  return {
    cursor: asStringOrNull(row.nextCursor),
    cursorId: asStringOrNull(row.nextCursorId),
  };
}

export async function listFeedDisciplines(options?: {
  targetUserId?: string | null;
}): Promise<FeedDiscipline[]> {
  const { data, error } = await getSupabaseClient().rpc('list_feed_disciplines', {
    p_target_user_id: options?.targetUserId ?? null,
  });
  if (error) throw error;
  return asArray(asRecord(data).disciplines).map(mapFeedDiscipline);
}

export async function listFeedPosts(options: {
  disciplineId?: string | null;
  targetUserId?: string | null;
  authorId?: string | null;
  cursor?: FeedCursor | null;
  limit?: number;
}): Promise<FeedPostsPage> {
  const { data, error } = await getSupabaseClient().rpc('list_feed_posts', {
    p_discipline_id: options.disciplineId ?? null,
    p_cursor_published_at: options.cursor?.cursor ?? null,
    p_cursor_id: options.cursor?.cursorId ?? null,
    p_limit: options.limit ?? FEED_PAGE_SIZE,
    p_target_user_id: options.targetUserId ?? null,
    p_author_id: options.authorId ?? null,
  });

  if (error) throw error;
  const row = asRecord(data);
  return {
    posts: asArray(row.posts).map(mapFeedPost),
    disciplines: asArray(row.disciplines).map(mapFeedDiscipline),
    ...mapCursor(row),
  };
}

export async function createFeedPost(input: {
  disciplineId: string;
  body: string;
  media: FeedMediaItem[];
  targetUserId?: string | null;
}): Promise<FeedPost> {
  const { data, error } = await getSupabaseClient().rpc('create_feed_post', {
    p_discipline_id: input.disciplineId,
    p_body: input.body,
    p_media: input.media,
    p_target_user_id: input.targetUserId ?? null,
  });
  if (error) throw error;
  return mapFeedPost(data);
}

export async function deleteFeedPost(input: {
  postId: string;
  targetUserId?: string | null;
}): Promise<void> {
  const { error } = await getSupabaseClient().rpc('delete_own_feed_post', {
    p_post_id: input.postId,
    p_target_user_id: input.targetUserId ?? null,
  });
  if (error) throw error;
}

export async function toggleFeedLike(postId: string): Promise<FeedPost> {
  const { data, error } = await getSupabaseClient().rpc('toggle_feed_like', {
    p_post_id: postId,
  });
  if (error) throw error;
  return mapFeedPost(data);
}

export async function recordFeedShare(postId: string): Promise<FeedPost> {
  const { data, error } = await getSupabaseClient().rpc('record_feed_share', {
    p_post_id: postId,
  });
  if (error) throw error;
  return mapFeedPost(data);
}

export async function getFeedPostThread(options: {
  postId: string;
  targetUserId?: string | null;
  authorId?: string | null;
}): Promise<{
  post: FeedPost;
  comments: FeedComment[];
  cursor: FeedCursor;
}> {
  const { data, error } = await getSupabaseClient().rpc('get_feed_post_thread', {
    p_post_id: options.postId,
    p_target_user_id: options.targetUserId ?? null,
    p_author_id: options.authorId ?? null,
  });
  if (error) throw error;
  const row = asRecord(data);
  return {
    post: mapFeedPost(row.post),
    comments: asArray(row.comments).map(mapFeedComment),
    cursor: mapCursor(row),
  };
}

export async function listFeedComments(options: {
  postId: string;
  targetUserId?: string | null;
  authorId?: string | null;
  cursor?: FeedCursor | null;
  limit?: number;
}): Promise<FeedCommentsPage> {
  const { data, error } = await getSupabaseClient().rpc('list_feed_comments', {
    p_post_id: options.postId,
    p_cursor_created_at: options.cursor?.cursor ?? null,
    p_cursor_id: options.cursor?.cursorId ?? null,
    p_limit: options.limit ?? 20,
    p_target_user_id: options.targetUserId ?? null,
    p_author_id: options.authorId ?? null,
  });
  if (error) throw error;
  const row = asRecord(data);
  return {
    comments: asArray(row.comments).map(mapFeedComment),
    ...mapCursor(row),
  };
}

export async function createFeedComment(input: {
  postId: string;
  body: string;
}): Promise<{ comment: FeedComment; post: FeedPost }> {
  const { data, error } = await getSupabaseClient().rpc('create_feed_comment', {
    p_post_id: input.postId,
    p_body: input.body,
  });
  if (error) throw error;
  const row = asRecord(data);
  return {
    comment: mapFeedComment(row.comment),
    post: mapFeedPost(row.post),
  };
}

export async function deleteFeedComment(commentId: string): Promise<{ post: FeedPost | null }> {
  const { data, error } = await getSupabaseClient().rpc('delete_own_feed_comment', {
    p_comment_id: commentId,
  });
  if (error) throw error;
  const post = asRecord(data).post;
  return { post: post ? mapFeedPost(post) : null };
}

export async function getFeedProfile(options: {
  userId: string;
  targetUserId?: string | null;
  cursor?: FeedCursor | null;
  limit?: number;
}): Promise<FeedProfilePage> {
  const { data, error } = await getSupabaseClient().rpc('get_feed_profile', {
    p_user_id: options.userId,
    p_cursor_published_at: options.cursor?.cursor ?? null,
    p_cursor_id: options.cursor?.cursorId ?? null,
    p_limit: options.limit ?? FEED_PAGE_SIZE,
    p_target_user_id: options.targetUserId ?? null,
  });
  if (error) throw error;
  const row = asRecord(data);
  const profile = asRecord(row.profile);
  return {
    profile: {
      id: coerceString(profile.id),
      name: coerceString(profile.name, 'Member'),
      avatarUrl: asStringOrNull(profile.avatarUrl),
      bio: asStringOrNull(profile.bio),
      role: asStringOrNull(profile.role),
      isVerifiedCoach: profile.isVerifiedCoach === true,
      beltRank: asStringOrNull(profile.beltRank),
      beltStripes: coerceNumber(profile.beltStripes),
      primaryDiscipline: asStringOrNull(profile.primaryDiscipline),
      memberSince: asStringOrNull(profile.memberSince),
      postCount: coerceNumber(profile.postCount),
      followerCount: coerceNumber(profile.followerCount),
      isFollowing: profile.isFollowing === true,
    },
    posts: asArray(row.posts).map(mapFeedPost),
    ...mapCursor(row),
  };
}

export async function searchFeed(options: {
  query: string;
  type: FeedSearchType;
  offset?: number | null;
  limit?: number;
}): Promise<FeedSearchPage> {
  const { data, error } = await getSupabaseClient().rpc('search_feed', {
    p_query: options.query,
    p_type: options.type,
    p_limit: options.limit ?? 20,
    p_offset: options.offset ?? 0,
  });
  if (error) throw error;
  const row = asRecord(data);
  return {
    users: asArray(row.users).map((value) => {
      const user = asRecord(value);
      return {
        id: coerceString(user.id),
        name: coerceString(user.name, 'Member'),
        avatarUrl: asStringOrNull(user.avatarUrl),
        bio: asStringOrNull(user.bio),
        role: asStringOrNull(user.role),
        isVerifiedCoach: user.isVerifiedCoach === true,
        beltRank: asStringOrNull(user.beltRank),
        beltStripes: coerceNumber(user.beltStripes),
        primaryDiscipline: asStringOrNull(user.primaryDiscipline),
        memberSince: asStringOrNull(user.memberSince),
        postCount: coerceNumber(user.postCount),
        followerCount: coerceNumber(user.followerCount),
      };
    }),
    posts: asArray(row.posts).map(mapFeedPost),
    nextOffset: typeof row.nextOffset === 'number' ? row.nextOffset : null,
  };
}

export async function toggleFeedFollow(followeeId: string): Promise<{ isFollowing: boolean }> {
  const { data: userData } = await getSupabaseClient().auth.getUser();
  const followerId = userData.user?.id;
  if (!followerId) throw new Error('Not authenticated');

  const { data, error: selectError } = await getSupabaseClient()
    .from('feed_profile_follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)
    .maybeSingle();

  if (selectError) throw selectError;

  if (data) {
    const { error: deleteError } = await getSupabaseClient()
      .from('feed_profile_follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('followee_id', followeeId);
    if (deleteError) throw deleteError;
    return { isFollowing: false };
  } else {
    const { error: insertError } = await getSupabaseClient()
      .from('feed_profile_follows')
      .insert({ follower_id: followerId, followee_id: followeeId });
    if (insertError) throw insertError;
    return { isFollowing: true };
  }
}

