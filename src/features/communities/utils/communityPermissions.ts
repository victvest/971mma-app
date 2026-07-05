import type { UserRole } from '@/features/auth/types';
import type { CommunityChannelKind } from '@/types/domain';

export function canUseCoachCommunityTools(role: UserRole | null | undefined): boolean {
  return role === 'coach' || role === 'admin';
}

export function canManageCommunityChannel(
  role: UserRole | null | undefined,
  isCoachOwner: boolean,
  viewingChild = false,
): boolean {
  return canUseCoachCommunityTools(role) && isCoachOwner && !viewingChild;
}

/**
 * Group channels are a flat chat: any member who can load the channel (already
 * gated server-side by can_access_community_channel) can post. Community
 * (discipline-wide broadcast) channels stay coach-owner only.
 */
export function canPostInCommunityChannel(
  channelKind: CommunityChannelKind,
  role: UserRole | null | undefined,
  isCoachOwner: boolean,
  viewingChild = false,
): boolean {
  if (channelKind === 'community') {
    return canManageCommunityChannel(role, isCoachOwner, viewingChild);
  }
  return !viewingChild;
}
