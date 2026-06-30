import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMyProfile } from '@/services/database/profiles.repository';
import { syncProfileAfterMutation } from '@/features/profile/services/profileCacheSync';
import { useAuthStore } from '@/stores/useAuthStore';
import type { MemberProfile, ProfilePatch } from '@/types/domain';

export function useUpdateProfile(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation<MemberProfile, Error, ProfilePatch>({
    mutationFn: updateMyProfile,
    onSuccess: async (profile) => {
      if (userId && profile.id === userId) {
        await syncProfileAfterMutation(queryClient, profile);
      }
      useAuthStore.getState().updateUserIdentity({ fullName: profile.fullName });
    },
  });
}
