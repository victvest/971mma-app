export type FeedMediaItem = {
  id: string;
  type: 'image';
  url: string;
  path?: string | null;
  width?: number | null;
  height?: number | null;
};

export type FeedDiscipline = {
  id: string;
  slug: string;
  displayName: string;
  hasRankProgression: boolean;
  isMemberDiscipline: boolean;
};

export type FeedPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorBio: string | null;
  authorRole: string | null;
  isVerifiedCoach: boolean;
  disciplineId: string;
  disciplineName: string;
  disciplineSlug: string;
  body: string;
  media: FeedMediaItem[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  myLiked: boolean;
  canDelete: boolean;
  publishedAt: string;
  createdAt: string;
};

export type FeedComment = {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorRole: string | null;
  isVerifiedCoach: boolean;
  body: string;
  canDelete: boolean;
  createdAt: string;
};

export type FeedLikeUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string | null;
  isVerifiedCoach: boolean;
  beltRank: string | null;
  beltStripes: number;
  likedAt: string;
};

export type FeedProfile = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string | null;
  isVerifiedCoach: boolean;
  beltRank: string | null;
  beltStripes: number;
  primaryDiscipline: string | null;
  memberSince: string | null;
  postCount: number;
  followerCount: number;
  isFollowing: boolean;
};

export type FeedCursor = {
  cursor: string | null;
  cursorId: string | null;
};

export type FeedPostsPage = FeedCursor & {
  posts: FeedPost[];
  disciplines: FeedDiscipline[];
};

export type FeedCommentsPage = FeedCursor & {
  comments: FeedComment[];
};

export type FeedProfilePage = FeedCursor & {
  profile: FeedProfile;
  posts: FeedPost[];
};

export type FeedSearchUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string | null;
  isVerifiedCoach: boolean;
  beltRank: string | null;
  beltStripes: number;
  primaryDiscipline: string | null;
  memberSince: string | null;
  postCount: number;
  followerCount: number;
};

export type FeedSearchPage = {
  users: FeedSearchUser[];
  posts: FeedPost[];
  nextOffset: number | null;
};

export type FeedSearchType = 'all' | 'users' | 'posts';
