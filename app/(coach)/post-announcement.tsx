import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

/** Legacy route — coaches post directly in the group chat. */
export default function CoachPostAnnouncementScreen() {
  const router = useRouter();
  const { channelId } = useLocalSearchParams<{ channelId?: string }>();
  const initialChannelId = typeof channelId === 'string' ? channelId : undefined;

  useEffect(() => {
    if (initialChannelId) {
      router.replace(`/communities/${initialChannelId}`);
      return;
    }
    router.replace('/(coach)/communities');
  }, [initialChannelId, router]);

  return null;
}
