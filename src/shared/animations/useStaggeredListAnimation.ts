import type { ViewStyle } from 'react-native';

type Options = {
  staggerDelay?: number;
  initialOffsetY?: number;
  fadeDuration?: number;
  enabled?: boolean;
};

const STATIC_STYLE: ViewStyle = { opacity: 1 };

export function useStaggeredListAnimation(
  _index: number,
  _options: Options = {},
): ViewStyle {
  return STATIC_STYLE;
}
