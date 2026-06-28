import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import {
  ROLL_CALL_DEMO_SUMMARY_NAMES,
  stitchAvatarForDisplayName,
} from '@/features/coach/roll-call/fixtures/rollCallStitchAvatars';

const FIRST_NAMES = [
  'Alex',
  'Jordan',
  'Sam',
  'Riley',
  'Casey',
  'Taylor',
  'Morgan',
  'Avery',
  'Quinn',
  'Reese',
  'Blake',
  'Drew',
  'Skyler',
  'Jamie',
  'Noah',
  'Emma',
  'Liam',
  'Olivia',
  'Ethan',
  'Mia',
  'Lucas',
  'Sofia',
  'Amir',
  'Layla',
];

const LAST_NAMES = [
  'Martinez',
  'Okonkwo',
  'Chen',
  'Patel',
  'Garcia',
  'Nguyen',
  'Ali',
  'Johnson',
  'Williams',
  'Brown',
  'Khan',
  'Silva',
  'Kim',
  'Hassan',
  'Murphy',
  'Singh',
  'Cohen',
  'Rivera',
  'Bauer',
  'Sato',
  'Dubois',
  'Ibrahim',
  'Foster',
  'Nielsen',
];

const BELTS = ['White Belt', 'Blue Belt', 'Purple Belt', null] as const;

function buildMockMember(index: number): RollCallDeckMember {
  const demoName = ROLL_CALL_DEMO_SUMMARY_NAMES[index];
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[index % LAST_NAMES.length];
  const displayName =
    demoName ??
    (index === 0 ? 'Alexandra Martinez-Hernandez' : `${first} ${last}`);
  const userId =
    index % 5 === 1 ? null : `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
  const mindbodyClientId = String(200000 + index);
  const deckKey = userId ?? `mb:${mindbodyClientId}`;

  return {
    deckKey,
    displayName,
    avatarUrl: stitchAvatarForDisplayName(displayName),
    beltRank: BELTS[index % BELTS.length],
    beltStripes: index % 3,
    userId,
    mindbodyClientId,
    mark: null,
    isOnApp: userId !== null,
    isBookedOnRoster: true,
    hasFacilityCheckInToday: index % 6 === 0,
    isWalkIn: false,
    isGuest: false,
    presentedBy: null,
  };
}

/** 24-member deck for Phase 7 performance / stack testing. */
export const ROLL_CALL_MOCK_DECK_24: RollCallDeckMember[] = Array.from({ length: 24 }, (_, index) =>
  buildMockMember(index),
);

export function buildRollCallMockDeck(count: number): RollCallDeckMember[] {
  return Array.from({ length: count }, (_, index) => buildMockMember(index));
}
