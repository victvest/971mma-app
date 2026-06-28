import type { WithSpringConfig } from 'react-native-reanimated';

/** Commit when horizontal drag exceeds ~25% of card width (TINDER Phase 6). */
export const ROLL_CALL_SWIPE_THRESHOLD_RATIO = 0.25;

export const HUD_REVEAL_DURATION_MS = 200;
export const HUD_DISMISS_DURATION_MS = 180;
/** Each floating HUD wing spans at least this fraction of screen width. */
export const HUD_WING_WIDTH_RATIO = 0.17;
/** Minimum vertical span of each HUD wing within the card stack. */
export const HUD_WING_MIN_HEIGHT_RATIO = 0.7;
/** HUD wing height as a fraction of the device screen. */
export const HUD_SCREEN_HEIGHT_RATIO = 0.6;

export type RollCallSwipeCommit = 'attended' | 'absent';

export const rollCallSwipeSpringOffscreen = {
  damping: 24,
  stiffness: 220,
  mass: 0.9,
} satisfies WithSpringConfig;

export const rollCallSwipeSpringReset = {
  damping: 22,
  stiffness: 260,
  mass: 0.85,
} satisfies WithSpringConfig;

export function rollCallSwipeThreshold(screenWidth: number): number {
  'worklet';
  return screenWidth * ROLL_CALL_SWIPE_THRESHOLD_RATIO;
}

export function rollCallOffscreenTranslation(
  screenWidth: number,
  direction: RollCallSwipeCommit,
): number {
  'worklet';
  return direction === 'attended' ? screenWidth * 1.25 : -screenWidth * 1.25;
}

export function rollCallPresentOverlayOpacity(
  translationX: number,
  screenWidth: number,
): number {
  'worklet';
  const threshold = rollCallSwipeThreshold(screenWidth);
  if (threshold <= 0) return 0;
  return Math.min(Math.max(translationX / threshold, 0), 1);
}

export function rollCallAbsentOverlayOpacity(
  translationX: number,
  screenWidth: number,
): number {
  'worklet';
  const threshold = rollCallSwipeThreshold(screenWidth);
  if (threshold <= 0) return 0;
  return Math.min(Math.max(-translationX / threshold, 0), 1);
}

function swipeProgressForSide(
  side: 'left' | 'right',
  translationX: number,
  screenWidth: number,
): number {
  'worklet';
  return side === 'right'
    ? rollCallPresentOverlayOpacity(translationX, screenWidth)
    : rollCallAbsentOverlayOpacity(translationX, screenWidth);
}

function opposingProgressForSide(
  side: 'left' | 'right',
  translationX: number,
  screenWidth: number,
): number {
  'worklet';
  return side === 'right'
    ? rollCallAbsentOverlayOpacity(translationX, screenWidth)
    : rollCallPresentOverlayOpacity(translationX, screenWidth);
}

/** Floating wing visibility — hidden at idle, strong color on touch. */
export function rollCallHudWingOpacity(
  side: 'left' | 'right',
  translationX: number,
  screenWidth: number,
  hudReveal: number,
): number {
  'worklet';
  if (hudReveal <= 0.01) return 0;

  const progress = swipeProgressForSide(side, translationX, screenWidth);
  const opposing = opposingProgressForSide(side, translationX, screenWidth);
  const base = 0.88 * hudReveal;

  if (opposing > 0.12) {
    return Math.max(0.32, base * (1 - opposing * 0.55));
  }

  return Math.min(1, base + progress * 0.12);
}

/** Colored fill intensity inside each wing. */
export function rollCallHudWingFillOpacity(
  side: 'left' | 'right',
  translationX: number,
  screenWidth: number,
  hudReveal: number,
): number {
  'worklet';
  if (hudReveal <= 0.01) return 0;

  const progress = swipeProgressForSide(side, translationX, screenWidth);
  return Math.min(0.94, 0.5 * hudReveal + progress * 0.44);
}

/** @deprecated alias — use rollCallHudWingOpacity */
export function rollCallHudBadgeOpacity(
  side: 'left' | 'right',
  translationX: number,
  screenWidth: number,
  hudReveal: number,
): number {
  'worklet';
  return rollCallHudWingOpacity(side, translationX, screenWidth, hudReveal);
}

export function rollCallHudBadgeScale(
  side: 'left' | 'right',
  translationX: number,
  screenWidth: number,
  hudReveal: number,
): number {
  'worklet';
  const progress = swipeProgressForSide(side, translationX, screenWidth);
  const entrance = 0.9 + hudReveal * 0.06;
  return entrance + progress * 0.16;
}

export function rollCallHudIconScale(
  side: 'left' | 'right',
  translationX: number,
  screenWidth: number,
  hudReveal: number,
): number {
  'worklet';
  const progress = swipeProgressForSide(side, translationX, screenWidth);
  return (0.9 + hudReveal * 0.04) + progress * 0.22;
}

export function rollCallHudGlowRadius(
  side: 'left' | 'right',
  translationX: number,
  screenWidth: number,
  hudReveal: number,
): number {
  'worklet';
  const progress = swipeProgressForSide(side, translationX, screenWidth);
  return 10 + hudReveal * 6 + progress * 22;
}

export function rollCallHudLabelEmphasis(
  side: 'left' | 'right',
  translationX: number,
  screenWidth: number,
): number {
  'worklet';
  return swipeProgressForSide(side, translationX, screenWidth);
}

export function rollCallCardLiftY(
  translationX: number,
  screenWidth: number,
  hudReveal: number,
): number {
  'worklet';
  if (hudReveal <= 0) return 0;
  const dragLift = Math.min(Math.abs(translationX) / Math.max(screenWidth, 1) * 10, 10);
  return -3 - dragLift * hudReveal;
}

export function rollCallCardRotationDeg(
  translationX: number,
  screenWidth: number,
): number {
  'worklet';
  if (screenWidth <= 0) return 0;
  return (translationX / screenWidth) * 14;
}

export function rollCallResolveCommit(
  translationX: number,
  screenWidth: number,
): RollCallSwipeCommit | null {
  'worklet';
  const threshold = rollCallSwipeThreshold(screenWidth);
  if (translationX > threshold) return 'attended';
  if (translationX < -threshold) return 'absent';
  return null;
}
