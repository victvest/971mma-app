import { ENV } from '@/core/config/env';
import { useAuthStore } from '@/stores/useAuthStore';

export const COACH_DEMO_CLASS_PREFIX = 'demo-coach-class-';
export const COACH_DEMO_MEMBER_PREFIX = 'demo-candidate-';

/** Coach-only demo layer — opt-in via EXPO_PUBLIC_COACH_DEMO_MODE=true or using the App Store demo email. */
export function isCoachDemoMode(): boolean {
  const flag = ENV.COACH_DEMO_MODE?.trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'on') {
    return true;
  }

  const user = useAuthStore.getState().user;
  return user?.email === 'coachdemo@971mma.com';
}

export function isDemoCoachClassId(classId: string): boolean {
  return classId.startsWith(COACH_DEMO_CLASS_PREFIX);
}

export function isDemoCoachMemberId(userId: string): boolean {
  return userId.startsWith(COACH_DEMO_MEMBER_PREFIX);
}
