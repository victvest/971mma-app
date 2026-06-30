import type { useRouter } from 'expo-router';
import type { PersonaAction } from '../types';

type PersonaRouter = ReturnType<typeof useRouter>;

export function navigatePersonaAction(router: PersonaRouter, action: PersonaAction): void {
  const route = action.route.trim();

  switch (route) {
    case 'schedule':
      router.push('/(tabs)/schedule');
      return;
    case 'checkin':
      router.push('/(tabs)/checkin');
      return;
    case 'belt-path':
      router.push('/(tabs)/belt-path');
      return;
    case 'rewards':
      router.push('/(tabs)/rewards');
      return;
    case 'coaches':
      router.push('/(tabs)/coaches');
      return;
    case 'profile':
      router.push('/(tabs)/profile');
      return;
    case 'help':
      router.push('/help');
      return;
    case 'referrals':
      router.push('/referrals');
      return;
    default:
      break;
  }

  if (route.startsWith('class:')) {
    const classId = route.slice('class:'.length);
    if (classId) {
      router.push(`/classes/${classId}?origin=assistant`);
    }
    return;
  }

  if (route.startsWith('coach:')) {
    const coachId = route.slice('coach:'.length);
    if (coachId) {
      router.push(`/coaches/${coachId}?origin=assistant`);
    }
  }
}
