import { useLocalSearchParams } from 'expo-router';
import { PostCommentsScreen } from '@/features/feed/screens/PostCommentsScreen';

export default function FeedPostRoute() {
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  return <PostCommentsScreen postId={postId ?? ''} />;
}
