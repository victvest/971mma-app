import { Easing } from 'react-native';

/** Shared motion language — springs, easings, stagger for premium feel. */
export const motion = {
  spring: { damping: 22, stiffness: 260, mass: 0.85, useNativeDriver: true as const },
  springSoft: { damping: 26, stiffness: 170, mass: 1, useNativeDriver: true as const },
  springBounce: { damping: 14, stiffness: 200, mass: 0.9, useNativeDriver: true as const },
  duration: { fast: 240, normal: 480, slow: 720 },
  stagger: 52,
  easing: {
    out: Easing.bezier(0.22, 1, 0.36, 1),
    inOut: Easing.bezier(0.65, 0, 0.35, 1),
    expoOut: Easing.bezier(0.16, 1, 0.3, 1),
  },
} as const;
