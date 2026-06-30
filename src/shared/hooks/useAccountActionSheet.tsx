import { useCallback, useState } from 'react';
import { AccountActionSheet } from '@/shared/components/AccountActionSheet';
import type { AccountActionKey } from '@/shared/auth/accountActionCopy';
import { triggerLightImpact } from '@/shared/haptics';

export function useAccountActionSheet() {
  const [state, setState] = useState<AccountActionKey | null>(null);

  const prompt = useCallback((actionKey: AccountActionKey) => {
    triggerLightImpact();
    setState(actionKey);
  }, []);

  const dismiss = useCallback(() => {
    setState(null);
  }, []);

  const sheet = (
    <AccountActionSheet
      visible={state !== null}
      actionKey={state ?? 'check-in'}
      onDismiss={dismiss}
    />
  );

  return { prompt, dismiss, sheet, isVisible: state !== null };
}
