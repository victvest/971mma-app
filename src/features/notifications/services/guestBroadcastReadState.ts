import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getAnnouncements } from '@/services/database/announcements.repository';

const GUEST_BROADCAST_LAST_SEEN_KEY = '971mma.guest_broadcast_last_seen';

function canUseSecureStore(): boolean {
  return (
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
    typeof SecureStore.getItemAsync === 'function'
  );
}

export async function getGuestBroadcastLastSeen(): Promise<string | null> {
  if (!canUseSecureStore()) return null;

  try {
    return await SecureStore.getItemAsync(GUEST_BROADCAST_LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

export async function setGuestBroadcastLastSeen(iso: string): Promise<void> {
  if (!canUseSecureStore()) return;

  try {
    await SecureStore.setItemAsync(GUEST_BROADCAST_LAST_SEEN_KEY, iso);
  } catch {
    // Non-fatal — badge may reappear until the next successful write.
  }
}

export async function getGuestBroadcastUnreadCount(): Promise<number> {
  const announcements = await getAnnouncements();
  const lastSeen = await getGuestBroadcastLastSeen();

  if (!lastSeen) {
    return announcements.length;
  }

  const lastSeenTime = new Date(lastSeen).getTime();
  return announcements.filter((item) => new Date(item.createdAt).getTime() > lastSeenTime).length;
}

export async function markGuestBroadcastsSeen(): Promise<void> {
  await setGuestBroadcastLastSeen(new Date().toISOString());
}
