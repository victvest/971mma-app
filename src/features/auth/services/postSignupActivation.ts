import type { ApiError } from '@/lib/apiError';
import { authFeedback } from '@/features/auth/feedback/authFeedback';
import { applyProfileAuthInfo } from '@/features/auth/services/authProfileSync';
import { ensureMindbodyLink } from '@/features/auth/services/linkMindbody';
import { applyReferralCode } from '@/services/database/referrals.repository';
import { consumePendingReferralCode } from './referralCodeStorage';
import { useAuthStore, type AppUser } from '@/stores/useAuthStore';

export type SignupActivationResult = {
  accountStatus: AppUser['accountStatus'];
  linked: boolean;
};

function readLinkError(error: unknown): ApiError | null {
  if (!error || typeof error !== 'object') return null;
  return error as ApiError;
}

export async function completeSignupActivation(
  userId: string,
  email: string,
): Promise<SignupActivationResult> {
  const beforeStatus = useAuthStore.getState().user?.accountStatus;
  let linked = false;
  let linkError: ApiError | null = null;

  const pendingReferralCode = await consumePendingReferralCode();
  if (pendingReferralCode) {
    try {
      await applyReferralCode(pendingReferralCode);
    } catch {
      // Non-blocking — friend can apply the code again on activation screen.
    }
  }

  try {
    await ensureMindbodyLink();
    linked = true;
  } catch (error) {
    linkError = readLinkError(error);
  }

  await applyProfileAuthInfo(userId, email);
  const accountStatus = useAuthStore.getState().user?.accountStatus ?? 'registered';

  if (beforeStatus === accountStatus && accountStatus === 'active') {
    return { accountStatus, linked };
  }

  if (linked && accountStatus === 'active') {
    authFeedback.accountActivated();
  } else if (linkError?.rawCode === 'AMBIGUOUS_MATCH') {
    authFeedback.ambiguousMindbodyMatch();
  } else if (
    accountStatus === 'activation_required' ||
    linkError?.rawCode === 'NOT_LINKED' ||
    linkError?.rawCode === 'MINDBODY_TOKEN_REQUIRED'
  ) {
    authFeedback.activationRequired();
  } else if (accountStatus === 'active') {
    authFeedback.accountCreated();
  } else {
    authFeedback.accountCreatedPending();
  }

  return { accountStatus, linked };
}
