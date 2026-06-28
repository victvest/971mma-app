import type { RollCallDeckMember, RollCallMarkMetadata, RollCallMemberStatus } from '@/features/coach/roll-call/types';

export type RollCallDeckMarkStatus = Extract<RollCallMemberStatus, 'present' | 'absent' | 'late'>;

export function buildRollCallMarkMetadata(
  member: RollCallDeckMember,
  status: RollCallDeckMarkStatus,
): RollCallMarkMetadata | undefined {
  if (status === 'absent' && member.hasFacilityCheckInToday) {
    return { attendance_mismatch: true };
  }
  return undefined;
}
