import { Easing } from 'react-native-reanimated';
import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

export const duration = {
  instant: 100,

  fast: 200,

  base: 300,

  slow: 450,

  crawl: 650,

  ambient: 20000,
} as const;

export const easingCurves = {
  standard: Easing.bezier(0.4, 0, 0.2, 1),

  decelerate: Easing.bezier(0, 0, 0.2, 1),

  accelerate: Easing.bezier(0.4, 0, 1, 1),

  ios: Easing.bezier(0.25, 0.46, 0.45, 0.94),

  snappy: Easing.bezier(0.34, 1.2, 0.64, 1),

  gentle: Easing.bezier(0.43, 0.0, 0.25, 1.0),

  linear: Easing.linear,
} as const;

export const timing = {
  fade: {
    duration: duration.base,
    easing: easingCurves.standard,
  } satisfies WithTimingConfig,

  press: {
    duration: duration.fast,
    easing: easingCurves.snappy,
  } satisfies WithTimingConfig,

  modal: {
    duration: duration.slow,
    easing: easingCurves.decelerate,
  } satisfies WithTimingConfig,

  page: {
    duration: duration.slow,
    easing: easingCurves.ios,
  } satisfies WithTimingConfig,

  header: {
    duration: duration.fast,
    easing: easingCurves.gentle,
  } satisfies WithTimingConfig,

  shimmer: {
    duration: 1200,
    easing: easingCurves.linear,
  } satisfies WithTimingConfig,
} as const;

export const spring = {
  snappy: {
    damping: 18,
    stiffness: 300,
    mass: 0.8,
  } satisfies WithSpringConfig,

  gentle: {
    damping: 22,
    stiffness: 200,
    mass: 1.0,
  } satisfies WithSpringConfig,

  bouncy: {
    damping: 8,
    stiffness: 180,
    mass: 0.8,
  } satisfies WithSpringConfig,

  stiff: {
    damping: 30,
    stiffness: 400,
    mass: 0.9,
  } satisfies WithSpringConfig,

  slow: {
    damping: 26,
    stiffness: 140,
    mass: 1.2,
  } satisfies WithSpringConfig,

  /** Liquid tab-bar capsule — soft overshoot with a gentle settle. */
  water: {
    damping: 15,
    stiffness: 130,
    mass: 0.88,
  } satisfies WithSpringConfig,
} as const;

export const stagger = {
  fast: 40,
  base: 60,
  slow: 90,
} as const;

export const scale = {
  resting: 1,
  pressed: 0.98,
  entrance: 0.98,
} as const;

export const alpha = {
  hidden: 0,
  visible: 1,
  pressed: 0.72,
  muted: 0.58,
  glassNavLight: 0.42,
  glassNavDark: 0.5,
  glassDrawer: 0.58,
} as const;

export const interactionState = {
  idle: 0,
  focused: 1,
  error: 2,
} as const;

export const pullRefreshThreshold = 72;

/** Vertical travel (px) for entrance animations */
export const offset = {
  screen: 8,
  section: 16,
  list: 12,
} as const;

/**
 * Semantic motion presets — single source for Moti + Reanimated consumers.
 * Do not introduce ad-hoc durations outside this file.
 */
export const motion = {
  press: {
    scale: scale.pressed,
    opacity: alpha.pressed,
    duration: timing.press.duration,
    easing: timing.press.easing,
  },
  entrance: {
    screen: {
      offsetY: offset.screen,
      duration: duration.base,
      easing: easingCurves.ios,
    },
    section: {
      offsetY: offset.section,
      stagger: stagger.base,
      maxIndex: 8,
      spring: spring.gentle,
    },
    list: {
      offsetY: offset.list,
      stagger: stagger.fast,
      maxIndex: 12,
      duration: duration.base,
      easing: easingCurves.decelerate,
      spring: spring.gentle,
    },
  },
  modal: {
    in: {
      fromScale: 0.88,
      toScale: scale.resting,
      backdropDuration: 240,
      opacityDuration: duration.fast,
      spring: spring.snappy,
    },
    out: {
      toScale: 0.88,
      duration: duration.fast,
      opacityDuration: 180,
      easing: easingCurves.accelerate,
    },
  },
  progress: {
    duration: duration.slow,
    easing: easingCurves.decelerate,
  },
  crossfade: {
    duration: duration.fast,
    easing: easingCurves.decelerate,
  },
  layout: {
    list: {
      duration: duration.base,
      easing: easingCurves.decelerate,
    },
  },
  tabBar: {
    capsule: spring.water,
    capsuleStretch: {
      damping: 11,
      stiffness: 190,
      mass: 0.75,
    } satisfies WithSpringConfig,
    iconFocus: spring.snappy,
  },
} as const;

export const animations = {
  duration,
  easingCurves,
  timing,
  spring,
  stagger,
  scale,
  alpha,
  offset,
  motion,
  interactionState,
  pullRefreshThreshold,
} as const;
