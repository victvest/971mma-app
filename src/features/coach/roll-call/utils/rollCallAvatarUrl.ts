import { stitchAvatarForDisplayName } from '@/features/coach/roll-call/fixtures/rollCallStitchAvatars';

/** Demo stock photo — fall back to initials instead of showing placeholder faces. */
const BLOCKED_AVATAR_URL_FRAGMENTS = ['images.unsplash.com/photo-1544005313-94ddf0286df2'];

export function resolveRollCallAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl?.trim()) return null;
  if (BLOCKED_AVATAR_URL_FRAGMENTS.some((fragment) => avatarUrl.includes(fragment))) {
    return null;
  }
  return avatarUrl;
}

export function resolveRollCallMemberAvatar(member: {
  avatarUrl: string | null;
  displayName: string;
}): string | null {
  const resolved = resolveRollCallAvatarUrl(member.avatarUrl);
  if (resolved) return resolved;
  return stitchAvatarForDisplayName(member.displayName);
}
