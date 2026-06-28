import * as SecureStore from 'expo-secure-store';

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_ID: 'user_id',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export const secureStorage = {
  getItem: (key: string): Promise<string | null> =>
    SecureStore.getItemAsync(key),

  setItem: (key: string, value: string): Promise<void> =>
    SecureStore.setItemAsync(key, value),

  deleteItem: (key: string): Promise<void> =>
    SecureStore.deleteItemAsync(key),
};
