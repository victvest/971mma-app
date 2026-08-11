import React from 'react';
import { FamilyQrPager } from '@/features/checkin/components/FamilyQrPager';

type Props = {
  tabFocused: boolean;
  checkedInToday: boolean;
  checkedInAt?: string | null;
  token: string | null | undefined;
  expiresAt?: string | null;
  memberId?: string | null;
  passLoading: boolean;
  memberName: string;
  canShowActiveQr: boolean;
  expiryDate?: string | null;
  expiryLoading?: boolean;
  isGuest?: boolean;
  requiresAccount?: boolean;
  isRegistered?: boolean;
  onRequireAccount?: () => void;
};

export function CheckInEntranceSection({
  checkedInToday,
  checkedInAt,
  token,
  expiresAt,
  memberId,
  passLoading,
  memberName,
  canShowActiveQr,
  expiryDate,
  expiryLoading,
  isGuest = false,
  isRegistered = false,
  onRequireAccount,
}: Props) {
  return (
    <FamilyQrPager
      token={token}
      expiresAt={expiresAt}
      memberId={memberId}
      loading={passLoading}
      checkedInToday={checkedInToday}
      checkedInAt={checkedInAt}
      memberName={memberName}
      canShowActiveQr={canShowActiveQr}
      expiryDate={expiryDate}
      expiryLoading={expiryLoading}
      isGuest={isGuest}
      isRegistered={isRegistered}
      onRequireAccount={onRequireAccount}
    />
  );
}
