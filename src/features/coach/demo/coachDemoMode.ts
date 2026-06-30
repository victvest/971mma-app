import { ENV } from '@/core/config/env';

export const COACH_DEMO_CLASS_PREFIX = 'demo-coach-class-';
export const COACH_DEMO_MEMBER_PREFIX = 'demo-candidate-';

/** Coach-only demo layer — opt-in via EXPO_PUBLIC_COACH_DEMO_MODE=true only. */
export function isCoachDemoMode(): boolean {
  const flag = ENV.COACH_DEMO_MODE?.trim().toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'on';
}

export function isDemoCoachClassId(classId: string): boolean {
  return classId.startsWith(COACH_DEMO_CLASS_PREFIX);
}

export function isDemoCoachMemberId(userId: string): boolean {
  return userId.startsWith(COACH_DEMO_MEMBER_PREFIX);
}
