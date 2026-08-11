import { toUserFacingErrorMessage } from '@/lib/userFacingError';

/** Map redeem_reward exception codes to member-facing copy. */
export function mapRedeemErrorMessage(error: unknown): string {
  return toUserFacingErrorMessage(error, {
    fallback: 'Could not redeem this reward. Try again.',
  });
}
