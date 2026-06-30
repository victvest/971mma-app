import { fetch } from 'expo/fetch';
import { getSupabaseClient } from '@/services/supabase/client';
import { prepareAvatarForUpload } from '@/features/profile/services/prepareAvatarForUpload';

const AVATAR_BUCKET = 'avatars';

function extensionFromUri(_uri: string): string {
  return 'jpg';
}

function contentTypeForExtension(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const extension = extensionFromUri(localUri);
  const path = `${userId}/avatar.${extension}`;
  return uploadAvatarToPath(path, localUri);
}

export async function uploadPendingTraineeAvatar(guardianUserId: string, localUri: string): Promise<string> {
  const extension = extensionFromUri(localUri);
  const path = `${guardianUserId}/pending-trainees/${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}/avatar.${extension}`;
  return uploadAvatarToPath(path, localUri);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function uploadAvatarToPath(path: string, localUri: string): Promise<string> {
  const preparedUri = await prepareAvatarForUpload(localUri);
  const extension = extensionFromUri(preparedUri);
  const contentType = contentTypeForExtension(extension);

  const response = await fetch(preparedUri);
  const arrayBuffer = await response.arrayBuffer();

  const client = getSupabaseClient();
  const { error } = await client.storage.from(AVATAR_BUCKET).upload(path, arrayBuffer, {
    upsert: true,
    contentType,
  });

  if (error) throw error;

  const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function uploadAvatarWithRetry(
  userId: string,
  localUri: string,
  options?: { maxAttempts?: number },
): Promise<string> {
  const maxAttempts = options?.maxAttempts ?? 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await uploadAvatar(userId, localUri);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(Math.min(1_000 * 2 ** (attempt - 1), 5_000));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Could not upload your photo. Check your connection and try again.');
}
