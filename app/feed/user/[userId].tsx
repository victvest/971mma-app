import { useLocalSearchParams } from 'expo-router';
import { FeedProfileScreen } from '@/features/feed/screens/FeedProfileScreen';

export default function FeedUserRoute() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  return <FeedProfileScreen userId={userId ?? ''} />;
}
