import type { AccountActionKey } from '@/shared/auth/accountActionCopy';

type GuestTabAccessInput = {
  routeName: string;
  isAnonymousGuest: boolean;
  needsActivation: boolean;
};

/**
 * Returns the account-action sheet key when a main tab should not open for the
 * current guest state. Tab navigation must be blocked before switching tabs —
 * do not navigate first and bounce back with router.replace (that leaves sheets
 * open and causes UI flashes on tab screens).
 */
export function resolveGuestTabAction({
  routeName,
  isAnonymousGuest,
  needsActivation,
}: GuestTabAccessInput): AccountActionKey | null {
  if (routeName === 'feed' && (isAnonymousGuest || needsActivation)) {
    return 'access-feed';
  }

  if (routeName === 'checkin' && isAnonymousGuest) {
    return 'check-in';
  }

  return null;
}
