import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getMyGuardianLinks,
  getProfileSummaries,
  type ProfileSummaryMap,
} from '@/services/database/guardian.repository';
import { useAuthStore } from '@/stores/useAuthStore';
import { useActiveProfileStore } from '@/stores/useActiveProfileStore';
import type { ActiveProfileOption, GuardianLinkItem } from '@/types/domain';
import {
  activeProfileSummariesKey,
  guardianLinksKey,
} from '@/features/guardian/hooks/guardianQueryKeys';

type ActiveProfileOptionsState = {
  options: ActiveProfileOption[];
  isLoading: boolean;
  hasChildren: boolean;
};

type ActiveMemberContextValue = {
  authUserId: string;
  activeMemberId: string;
  isViewingChildProfile: boolean;
  activeProfileLabel: string;
  activeProfileAvatarUrl: string | null;
  activeGuardianLink: GuardianLinkItem | null;
  canShowChildQr: boolean;
  approvedGuardianLinks: GuardianLinkItem[];
  profileOptions: ActiveProfileOptionsState;
};

const EMPTY_LINKS: GuardianLinkItem[] = [];
const EMPTY_OPTIONS: ActiveProfileOption[] = [];
const EMPTY_SUMMARIES: ProfileSummaryMap = {};
const EMPTY_IDS: string[] = [];

const ActiveMemberContext = createContext<ActiveMemberContextValue | null>(null);

function useActiveMemberContext(): ActiveMemberContextValue {
  const value = useContext(ActiveMemberContext);
  if (!value) {
    throw new Error('Active member hooks must be used inside ActiveMemberProvider.');
  }
  return value;
}

export function ActiveMemberProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const authUserId = user?.id ?? '';
  const activeUserId = useActiveProfileStore((state) => state.activeUserId);

  const guardianLinksQuery = useQuery({
    queryKey: guardianLinksKey(authUserId),
    queryFn: getMyGuardianLinks,
    enabled: Boolean(authUserId),
    staleTime: 60 * 1000,
  });

  const guardianLinks = guardianLinksQuery.data ?? EMPTY_LINKS;
  const approvedGuardianLinks = useMemo(
    () => guardianLinks.filter((link) => link.status === 'approved' && link.traineeUserId),
    [guardianLinks],
  );

  const approvedTraineeIds = useMemo(
    () =>
      approvedGuardianLinks
        .map((link) => link.traineeUserId)
        .filter((traineeId): traineeId is string => Boolean(traineeId)),
    [approvedGuardianLinks],
  );

  const profileSummaryIds = useMemo(() => {
    if (!authUserId) return EMPTY_IDS;
    return Array.from(new Set([authUserId, ...approvedTraineeIds])).sort();
  }, [approvedTraineeIds, authUserId]);

  const profileSummaryIdsKey = profileSummaryIds.join(',');
  const summariesQuery = useQuery({
    queryKey: activeProfileSummariesKey(authUserId, profileSummaryIdsKey),
    queryFn: () => getProfileSummaries(profileSummaryIds),
    enabled: Boolean(authUserId) && profileSummaryIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const summaries = summariesQuery.data ?? EMPTY_SUMMARIES;

  const profileOptions = useMemo<ActiveProfileOption[]>(() => {
    if (!user) return EMPTY_OPTIONS;

    const selfSummary = summaries[user.id];
    const selfOption: ActiveProfileOption = {
      userId: user.id,
      label: selfSummary?.fullName || user.fullName || 'Me',
      isSelf: true,
      beltRank: selfSummary?.beltRank ?? null,
      avatarUrl: selfSummary?.avatarUrl ?? null,
    };

    const childOptions = approvedGuardianLinks.map((link) => {
      const traineeUserId = link.traineeUserId as string;
      const summary = summaries[traineeUserId];
      return {
        userId: traineeUserId,
        label: summary?.fullName || link.childDisplayName || 'Trainee',
        isSelf: false,
        beltRank: summary?.beltRank ?? null,
        avatarUrl: summary?.avatarUrl ?? link.childAvatarUrl,
      } satisfies ActiveProfileOption;
    });

    return [selfOption, ...childOptions];
  }, [approvedGuardianLinks, summaries, user]);

  const requestedChildId =
    activeUserId && activeUserId !== authUserId ? activeUserId : null;

  const activeGuardianLink = useMemo(() => {
    if (!requestedChildId) return null;
    return (
      approvedGuardianLinks.find((link) => link.traineeUserId === requestedChildId) ?? null
    );
  }, [approvedGuardianLinks, requestedChildId]);

  const activeMemberId = activeGuardianLink?.traineeUserId ?? authUserId;
  const isViewingChildProfile = Boolean(
    authUserId && activeMemberId && activeMemberId !== authUserId,
  );
  const activeOption =
    profileOptions.find((option) => option.userId === activeMemberId) ?? profileOptions[0];
  const activeProfileLabel =
    activeOption?.label ||
    (user
      ? isViewingChildProfile
        ? activeGuardianLink?.childDisplayName || 'Trainee'
        : user.fullName || 'Me'
      : 'Member');
  const activeProfileAvatarUrl =
    activeOption?.avatarUrl ?? activeGuardianLink?.childAvatarUrl ?? null;
  const canShowChildQr =
    !activeGuardianLink ||
    activeGuardianLink.accountMode === 'managed' ||
    activeGuardianLink.allowGuardianQr;

  const profileOptionsState = useMemo<ActiveProfileOptionsState>(
    () => ({
      options: profileOptions,
      isLoading: guardianLinksQuery.isLoading || summariesQuery.isLoading,
      hasChildren: approvedGuardianLinks.length > 0,
    }),
    [
      approvedGuardianLinks.length,
      guardianLinksQuery.isLoading,
      profileOptions,
      summariesQuery.isLoading,
    ],
  );

  const value = useMemo<ActiveMemberContextValue>(
    () => ({
      authUserId,
      activeMemberId,
      isViewingChildProfile,
      activeProfileLabel,
      activeProfileAvatarUrl,
      activeGuardianLink,
      canShowChildQr,
      approvedGuardianLinks,
      profileOptions: profileOptionsState,
    }),
    [
      activeGuardianLink,
      activeMemberId,
      activeProfileAvatarUrl,
      activeProfileLabel,
      approvedGuardianLinks,
      authUserId,
      canShowChildQr,
      isViewingChildProfile,
      profileOptionsState,
    ],
  );

  return (
    <ActiveMemberContext.Provider value={value}>
      {children}
    </ActiveMemberContext.Provider>
  );
}

export function useActiveMemberId(): string {
  return useActiveMemberContext().activeMemberId;
}

export function useIsViewingChildProfile(): boolean {
  return useActiveMemberContext().isViewingChildProfile;
}

export function useActiveProfileLabel(): string {
  return useActiveMemberContext().activeProfileLabel;
}

export function useActiveProfileAvatarUrl(): string | null {
  return useActiveMemberContext().activeProfileAvatarUrl;
}

export function useActiveGuardianLink(): GuardianLinkItem | null {
  return useActiveMemberContext().activeGuardianLink;
}

export function useGuardianCanShowChildQr(): boolean {
  return useActiveMemberContext().canShowChildQr;
}

export function useApprovedGuardianLinks(): GuardianLinkItem[] {
  return useActiveMemberContext().approvedGuardianLinks;
}

export function useActiveProfileOptions(): ActiveProfileOptionsState {
  return useActiveMemberContext().profileOptions;
}
