import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { MbError } from './errors.ts';

type GuardianLinkPermissions = {
  accountMode: 'managed' | 'independent';
  allowGuardianQr: boolean;
};

export async function resolveTargetUserId(
  svc: SupabaseClient,
  callerUserId: string,
  requestedTargetUserId?: string,
  options?: { requireGuardianQrPermission?: boolean },
): Promise<string> {
  const targetUserId = requestedTargetUserId?.trim();
  if (!targetUserId || targetUserId === callerUserId) {
    return callerUserId;
  }

  const { data: profile, error: profileError } = await svc
    .from('profiles')
    .select('role')
    .eq('id', callerUserId)
    .maybeSingle<{ role: string }>();

  if (!profileError && (profile?.role === 'admin' || profile?.role === 'coach')) {
    return targetUserId;
  }

  const { data, error } = await svc
    .from('guardian_links')
    .select('id, account_mode, allow_guardian_qr')
    .eq('guardian_user_id', callerUserId)
    .eq('trainee_user_id', targetUserId)
    .eq('status', 'approved')
    .maybeSingle<{
      id: string;
      account_mode: 'managed' | 'independent';
      allow_guardian_qr: boolean;
    }>();

  if (error || !data) {
    throw new MbError('FORBIDDEN', 'Not authorized to act for this trainee.');
  }

  if (options?.requireGuardianQrPermission) {
    assertGuardianQrAllowed({
      accountMode: data.account_mode,
      allowGuardianQr: data.allow_guardian_qr,
    });
  }

  return targetUserId;
}

export function assertGuardianQrAllowed(link: GuardianLinkPermissions): void {
  if (link.accountMode === 'managed' || link.allowGuardianQr) return;
  throw new MbError(
    'FORBIDDEN',
    'This trainee checks in from their own device. Switch to their profile on their phone, or ask staff to enable guardian check-in.',
  );
}

export async function getApprovedGuardianLink(
  svc: SupabaseClient,
  guardianUserId: string,
  traineeUserId: string,
): Promise<GuardianLinkPermissions | null> {
  const { data, error } = await svc
    .from('guardian_links')
    .select('account_mode, allow_guardian_qr')
    .eq('guardian_user_id', guardianUserId)
    .eq('trainee_user_id', traineeUserId)
    .eq('status', 'approved')
    .maybeSingle<{
      account_mode: 'managed' | 'independent';
      allow_guardian_qr: boolean;
    }>();

  if (error || !data) return null;

  return {
    accountMode: data.account_mode,
    allowGuardianQr: data.allow_guardian_qr,
  };
}
