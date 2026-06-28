import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE_BYTES = 1800;
const MANIFEST_SUFFIX = '.manifest';

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const encoder = new TextEncoder();
const memoryStorage = new Map<string, string>();

function canUseSecureStore(): boolean {
  const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';

  return (
    isNativeMobile &&
    typeof SecureStore.getItemAsync === 'function' &&
    typeof SecureStore.setItemAsync === 'function' &&
    typeof SecureStore.deleteItemAsync === 'function'
  );
}

function getManifestKey(key: string): string {
  return `${key}${MANIFEST_SUFFIX}`;
}

function getChunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of value) {
    const charBytes = encoder.encode(char).byteLength;

    if (current && currentBytes + charBytes > CHUNK_SIZE_BYTES) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }

    current += char;
    currentBytes += charBytes;
  }

  chunks.push(current);
  return chunks;
}

async function deleteChunks(key: string, count: number): Promise<void> {
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(getChunkKey(key, index)),
    ),
  );
}

async function removeStoredItem(key: string): Promise<void> {
  const manifest = await SecureStore.getItemAsync(getManifestKey(key));
  const chunkCount = manifest ? Number.parseInt(manifest, 10) : 0;

  if (Number.isFinite(chunkCount) && chunkCount > 0) {
    await deleteChunks(key, chunkCount);
  }

  await Promise.all([
    SecureStore.deleteItemAsync(getManifestKey(key)),
    SecureStore.deleteItemAsync(key),
  ]);
}

/** Reads the persisted chunk count for a SecureStore key (manifest only). */
export async function readSecureStoreChunkCount(key: string): Promise<number | null> {
  if (!canUseSecureStore()) return null;

  const manifest = await SecureStore.getItemAsync(getManifestKey(key));
  const chunkCount = manifest ? Number.parseInt(manifest, 10) : 0;
  if (!Number.isFinite(chunkCount) || chunkCount <= 0) {
    return null;
  }

  return chunkCount;
}

export const secureStorageAdapter: StorageAdapter = {
  async getItem(key) {
    if (!canUseSecureStore()) return memoryStorage.get(key) ?? null;

    const manifest = await SecureStore.getItemAsync(getManifestKey(key));
    const chunkCount = manifest ? Number.parseInt(manifest, 10) : 0;

    if (!Number.isFinite(chunkCount) || chunkCount <= 0) {
      return null;
    }

    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.getItemAsync(getChunkKey(key, index)),
      ),
    );

    if (chunks.some((chunk) => chunk === null)) {
      await removeStoredItem(key);
      return null;
    }

    return chunks.join('');
  },

  async setItem(key, value) {
    if (!canUseSecureStore()) {
      memoryStorage.set(key, value);
      return;
    }

    await removeStoredItem(key);

    const chunks = splitIntoChunks(value);
    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(getChunkKey(key, index), chunk)),
    );
    await SecureStore.setItemAsync(getManifestKey(key), String(chunks.length));
  },

  async removeItem(key) {
    if (!canUseSecureStore()) {
      memoryStorage.delete(key);
      return;
    }

    await removeStoredItem(key);
  },
};
