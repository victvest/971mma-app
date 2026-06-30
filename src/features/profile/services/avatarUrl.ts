const SUPABASE_AVATAR_PATH = '/storage/v1/object/public/avatars/';

/** True when the avatar was uploaded to our Supabase avatars bucket. */
export function isSupabaseStorageAvatar(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  return trimmed.includes(SUPABASE_AVATAR_PATH);
}

/** Remote URLs we can render after app restart; excludes local picker URIs. */
export function isPersistedAvatarUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  return /^https?:\/\//i.test(trimmed);
}

export function resolveMemberAvatarUrl(url: string | null | undefined): string | null {
  return isPersistedAvatarUrl(url) ? url!.trim() : null;
}
