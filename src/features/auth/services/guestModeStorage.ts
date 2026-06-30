import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const GUEST_MODE_KEY = '971mma.guest_mode';

function canUseSecureStore(): boolean {
  return (
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
    typeof SecureStore.getItemAsync === 'function'
  );
}

export async function isGuestModePersisted(): Promise<boolean> {
  if (!canUseSecureStore()) return false;

  try {
    const value = await SecureStore.getItemAsync(GUEST_MODE_KEY);
    return value === '1';
  } catch {
    return false;
  }
}

export async function persistGuestMode(active: boolean): Promise<void> {
  if (!canUseSecureStore()) return;

  try {
    if (active) {
      await SecureStore.setItemAsync(GUEST_MODE_KEY, '1');
      return;
    }

    await SecureStore.deleteItemAsync(GUEST_MODE_KEY);
  } catch {
    // Non-fatal — guest mode still works for the current session.
  }
}

export async function clearGuestMode(): Promise<void> {
  await persistGuestMode(false);
}
