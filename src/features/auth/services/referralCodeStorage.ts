import * as SecureStore from 'expo-secure-store';

const PENDING_REFERRAL_CODE_KEY = 'pending_referral_code';

export async function setPendingReferralCode(code: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    await SecureStore.deleteItemAsync(PENDING_REFERRAL_CODE_KEY);
    return;
  }
  await SecureStore.setItemAsync(PENDING_REFERRAL_CODE_KEY, normalized);
}

export async function peekPendingReferralCode(): Promise<string | null> {
  const code = await SecureStore.getItemAsync(PENDING_REFERRAL_CODE_KEY);
  return code?.trim() ? code.trim().toUpperCase() : null;
}

export async function consumePendingReferralCode(): Promise<string | null> {
  const code = await peekPendingReferralCode();
  if (code) {
    await SecureStore.deleteItemAsync(PENDING_REFERRAL_CODE_KEY);
  }
  return code;
}
