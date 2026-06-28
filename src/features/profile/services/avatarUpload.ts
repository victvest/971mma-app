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
