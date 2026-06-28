import { ENV } from '@/core/config/env';

export const COACH_DEMO_CLASS_PREFIX = 'demo-coach-class-';
export const COACH_DEMO_MEMBER_PREFIX = 'demo-candidate-';

/** Coach-only demo layer — enabled in dev unless explicitly disabled. */
export function isCoachDemoMode(): boolean {
  const flag = ENV.COACH_DEMO_MODE?.trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  if (flag === 'true' || flag === '1' || flag === 'on') return true;
  return __DEV__;
}

export function isDemoCoachClassId(classId: string): boolean {
  return classId.startsWith(COACH_DEMO_CLASS_PREFIX);
}

export function isDemoCoachMemberId(userId: string): boolean {
  return userId.startsWith(COACH_DEMO_MEMBER_PREFIX);
}
