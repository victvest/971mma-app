import { useMemo } from 'react';
import { dateOfBirthToAge } from '@/features/onboarding/services/onboardingValidation';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import { useAuthStore } from '@/stores/useAuthStore';

const TEEN_MAX_AGE = 17;
const MANAGED_TRAINEE_EMAIL_SUFFIX = '@971mma-managed.local';

export type ChildExperienceMode = {
  /** Logged-in member is a child/teen account (not parent viewing child). */
  isChildAccount: boolean;
  /** Parent is viewing a linked trainee profile. */
  isParentViewingChild: boolean;
  /** Larger typography and celebration-forward UI. */
  isCelebrationMode: boolean;
  /** Scale factor for child-friendly density. */
  uiScale: number;
};

export function useChildExperience(): ChildExperienceMode {
  const user = useAuthStore((state) => state.user);
  const profileQuery = useProfile();
  const isParentViewingChild = useIsViewingChildProfile();

  return useMemo(() => {
    const email = user?.email?.trim().toLowerCase() ?? '';
    const age = profileQuery.data?.dateOfBirth
      ? dateOfBirthToAge(profileQuery.data.dateOfBirth)
      : null;
    const isManagedTrainee = email.endsWith(MANAGED_TRAINEE_EMAIL_SUFFIX);
    const isTeenOrChild = age !== null && age <= TEEN_MAX_AGE;
    const isChildAccount = !isParentViewingChild && (isManagedTrainee || isTeenOrChild);
    const isCelebrationMode = isChildAccount || isParentViewingChild;

    return {
      isChildAccount,
      isParentViewingChild,
      isCelebrationMode,
      uiScale: isCelebrationMode ? 1.08 : 1,
    };
  }, [isParentViewingChild, profileQuery.data?.dateOfBirth, user?.email]);
}
