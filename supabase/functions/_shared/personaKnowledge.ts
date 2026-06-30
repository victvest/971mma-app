/** Static academy + app knowledge injected into the assistant context. */
export const PERSONA_ACADEMY_FAQ = [
  {
    id: 'checkin',
    question: 'How does QR check-in work?',
    answer:
      'Open the Check-in tab and choose Scan entrance. Point your camera at the QR code by the door — location is verified at the academy. You can also switch to My pass to show your personal QR for roll call. Both codes refresh automatically.',
  },
  {
    id: 'programs',
    question: 'What programs does the academy offer?',
    answer:
      'Brazilian Jiu-Jitsu (including Next Level BJJ), Freestyle Wrestling, Muay Thai, MMA, Boxing, Performance Fitness, Personal Training, and youth/teen programs.',
  },
  {
    id: 'beginners',
    question: 'Is 971 MMA suitable for beginners?',
    answer:
      'Yes. All skill levels are welcome. Coaches structure every class to accommodate newcomers.',
  },
  {
    id: 'gear',
    question: 'What gear do I need?',
    answer:
      'Comfortable workout clothes for most classes. BJJ requires a gi; No-Gi needs rash guard and grappling shorts. Muay Thai and Boxing require gloves and hand wraps. Ask the front desk before your first session.',
  },
  {
    id: 'belt',
    question: 'How does belt progression work?',
    answer:
      'Attendance requirements update from check-ins. Skill and assessment requirements are marked by your coach. The Belt Path tab shows rank, stripes, and remaining requirements.',
  },
  {
    id: 'rewards',
    question: 'How do rewards and points work?',
    answer:
      'You earn points from check-ins, milestones, streaks, and referrals. Spend points in the Rewards tab on catalog items. Your tier (Bronze, Silver, Gold, etc.) reflects lifetime engagement.',
  },
  {
    id: 'membership-freeze',
    question: 'Can I freeze my membership?',
    answer:
      'Membership freezes and billing changes are handled by the front desk. Contact info@971mma.com or +971 54 332 3980.',
  },
  {
    id: 'membership-status',
    question: 'Why is my membership not active?',
    answer:
      'Membership is synced from the academy system. Pull to refresh on Profile, then contact support if it still looks wrong.',
  },
] as const;

export const PERSONA_APP_AREAS = [
  { id: 'home', name: 'Home', description: 'Dashboard with upcoming classes, streak, points, and belt snapshot.' },
  { id: 'schedule', name: 'Schedule', description: 'Browse and open class details for the full weekly timetable.' },
  { id: 'checkin', name: 'Check-in', description: 'Scan entrance QR or show your member pass QR.' },
  { id: 'coaches', name: 'Coaches', description: 'Coach profiles, bios, specialties, and their upcoming classes.' },
  { id: 'belt-path', name: 'Belt Path', description: 'Rank, stripes, promotion history, and requirement checklist.' },
  { id: 'rewards', name: 'Rewards', description: 'Points balance, tier, milestones, catalog, and redemptions.' },
  { id: 'profile', name: 'Profile', description: 'Membership status, personal details, and account settings.' },
  { id: 'help', name: 'Help & Support', description: 'FAQs and contact the academy team.' },
  { id: 'communities', name: 'Communities', description: 'Academy groups and announcements when enrolled.' },
  { id: 'referrals', name: 'Referrals', description: 'Share your code — both members earn bonus points after activation.' },
] as const;

export const PERSONA_ALLOWED_ACTION_ROUTES = [
  'schedule',
  'checkin',
  'belt-path',
  'rewards',
  'coaches',
  'profile',
  'help',
  'referrals',
] as const;

export type PersonaAllowedRoute = (typeof PERSONA_ALLOWED_ACTION_ROUTES)[number] | `class:${string}` | `coach:${string}`;

export function sanitizePersonaActions(
  actions: Array<{ label?: string; route?: string }> | undefined,
): Array<{ label: string; route: string }> {
  if (!actions?.length) return [];

  const seen = new Set<string>();
  const sanitized: Array<{ label: string; route: string }> = [];

  for (const action of actions) {
    const route = typeof action.route === 'string' ? action.route.trim() : '';
    const label = typeof action.label === 'string' ? action.label.trim() : '';
    if (!route || !label || seen.has(route)) continue;

    const isStatic = (PERSONA_ALLOWED_ACTION_ROUTES as readonly string[]).includes(route);
    const isClass = /^class:[0-9a-f-]{36}$/i.test(route);
    const isCoach = /^coach:[0-9a-f-]{36}$/i.test(route);
    if (!isStatic && !isClass && !isCoach) continue;

    seen.add(route);
    sanitized.push({ label: label.slice(0, 40), route });
    if (sanitized.length >= 3) break;
  }

  return sanitized;
}
