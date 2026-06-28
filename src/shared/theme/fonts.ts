import type { FontWeight } from './typography';

/**
 * Typography roles — swap `fontStacks` to retheme the whole app.
 *
 * - **display** (General Sans): headlines, titles, large marketing type (≥ `displayMinFontSize`)
 * - **body** (Inter): UI copy, labels, captions, buttons
 */
export type FontRole = 'display' | 'body';

/** Font sizes at or above this value use the display stack unless a preset sets `role` explicitly. */
export const displayMinFontSize = 17;

type FontStack = {
  label: string;
  faces: Record<FontWeight, string>;
};

export const fontStacks = {
  display: {
    label: 'General Sans',
    faces: {
      '400': 'GeneralSans-Regular',
      '500': 'GeneralSans-Medium',
      '600': 'GeneralSans-Semibold',
      '700': 'GeneralSans-Bold',
      '800': 'GeneralSans-Bold',
      '900': 'GeneralSans-Bold',
    },
  },
  body: {
    label: 'Inter',
    faces: {
      '400': 'Inter_400Regular',
      '500': 'Inter_500Medium',
      '600': 'Inter_600SemiBold',
      '700': 'Inter_700Bold',
      '800': 'Inter_800ExtraBold',
      '900': 'Inter_900Black',
    },
  },
} as const satisfies Record<FontRole, FontStack>;

export function resolveFontRole(fontSize: number, explicit?: FontRole): FontRole {
  if (explicit) return explicit;
  return fontSize >= displayMinFontSize ? 'display' : 'body';
}

/** Resolve a loaded `fontFamily` for Text — weight is encoded in the face name. */
export function resolveFontFamily(role: FontRole, weight: FontWeight): string {
  return fontStacks[role].faces[weight] ?? fontStacks[role].faces['400'];
}

export const fontFamily = {
  display: fontStacks.display.faces['400'],
  body: fontStacks.body.faces['400'],
  /** Legacy alias — prefer `body` or text presets */
  sans: fontStacks.body.faces['400'],
} as const;
