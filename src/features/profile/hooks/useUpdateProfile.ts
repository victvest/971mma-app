import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMyProfile } from '@/services/database/profiles.repository';
import { useAuthStore } from '@/stores/useAuthStore';
import type { MemberProfile, ProfilePatch } from '@/types/domain';
import { profileKey } from './useProfile';

export function useUpdateProfile(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation<MemberProfile, Error, ProfilePatch>({
    mutationFn: updateMyProfile,
    onSuccess: (profile) => {
      if (userId) {
        queryClient.setQueryData(profileKey(userId), profile);
      }
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['active-profile-summaries'] });
      useAuthStore.getState().updateUserIdentity({ fullName: profile.fullName });
    },
  });
}
