import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyGuardianLinks,
  getMyGuardians,
  revokeGuardianLink,
} from '@/services/database/guardian.repository';
import type { GuardianLinkRow } from '@/types/database';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import { useAuthStore } from '@/stores/useAuthStore';
import { useActiveProfileStore } from '@/stores/useActiveProfileStore';
import type { GuardianLinkItem } from '@/types/domain';
import { guardianLinksKey } from '@/features/guardian/hooks/guardianQueryKeys';
import { useActiveProfileOptions as useResolvedActiveProfileOptions } from '@/features/guardian/context/ActiveMemberProvider';

export { guardianLinksKey } from '@/features/guardian/hooks/guardianQueryKeys';

const EMPTY_GUARDIAN_LINKS: GuardianLinkItem[] = [];

function mapGuardianLinkRow(row: GuardianLinkRow): GuardianLinkItem {
  return {
    id: row.id,
    guardianUserId: row.guardian_user_id,
    traineeUserId: row.trainee_user_id,
    status: row.status,
    childDisplayName: row.child_display_name,
    childDateOfBirth: row.child_date_of_birth,
    childEmail: row.child_email,
    childPhone: row.child_phone,
    mindbodyClientId: row.mindbody_client_id,
    requestNotes: row.request_notes,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at,
    rejectedReason: row.rejected_reason,
    accountMode: row.account_mode ?? 'managed',
    allowGuardianQr: row.allow_guardian_qr ?? true,
    childAvatarUrl: row.child_avatar_url ?? null,
  };
}

export function useGuardianLinks() {
  const userId = useAuthStore((s) => s.user?.id ?? '');

  return useQuery({
    queryKey: guardianLinksKey(userId),
    queryFn: getMyGuardianLinks,
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  });
}

export function useApprovedGuardianLinks(): GuardianLinkItem[] {
  const query = useGuardianLinks();
  const links = query.data ?? EMPTY_GUARDIAN_LINKS;
  return useMemo(
    () => links.filter((link) => link.status === 'approved' && link.traineeUserId),
    [links],
  );
}

export function useMyGuardiansAsTrainee() {
  const userId = useAuthStore((s) => s.user?.id ?? '');

  return useQuery({
    queryKey: ['my-guardians', userId],
    queryFn: getMyGuardians,
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  });
}

export function useRevokeGuardianLink() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const queryClient = useQueryClient();
  const resetActiveProfile = useActiveProfileStore((s) => s.reset);

  return useMutation({
    mutationFn: (linkId: string) => revokeGuardianLink(linkId),
    onSuccess: () => {
      resetActiveProfile();
      void queryClient.invalidateQueries({ queryKey: guardianLinksKey(userId) });
    },
  });
}

export function useActiveProfileOptions() {
  return useResolvedActiveProfileOptions();
}

type PendingGuardianLinksResponse = {
  links: GuardianLinkRow[];
};

export function usePendingGuardianLinksAdmin() {
  const role = useAuthStore((s) => s.role);

  return useQuery({
    queryKey: ['guardian-links-pending-admin'],
    queryFn: async () => {
      const result = await invokeEdge<PendingGuardianLinksResponse>('guardian-approve', {
        action: 'list_pending',
      });
      return (result.links ?? []).map(mapGuardianLinkRow);
    },
    enabled: role === 'admin',
    staleTime: 30 * 1000,
  });
}

export function useApproveGuardianLinkAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      linkId: string;
      traineeUserId?: string;
      mindbodyClientId?: string;
      accountMode?: 'managed' | 'independent';
      allowGuardianQr?: boolean;
    }) =>
      invokeEdge('guardian-approve', {
        action: 'approve',
        linkId: input.linkId,
        traineeUserId: input.traineeUserId,
        mindbodyClientId: input.mindbodyClientId,
        accountMode: input.accountMode,
        allowGuardianQr: input.allowGuardianQr,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['guardian-links-pending-admin'] });
      void queryClient.invalidateQueries({ queryKey: ['guardian-links'] });
    },
  });
}

export function useRejectGuardianLinkAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { linkId: string; reason?: string }) =>
      invokeEdge('guardian-approve', {
        action: 'reject',
        linkId: input.linkId,
        reason: input.reason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['guardian-links-pending-admin'] });
      void queryClient.invalidateQueries({ queryKey: ['guardian-links'] });
    },
  });
}

export function useRevokeGuardianLinkAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { linkId: string; reason?: string }) =>
      invokeEdge('guardian-approve', {
        action: 'revoke',
        linkId: input.linkId,
        reason: input.reason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['guardian-links-pending-admin'] });
      void queryClient.invalidateQueries({ queryKey: ['guardian-links'] });
    },
  });
}
