import React, { forwardRef } from 'react';
import type { ScrollViewProps } from 'react-native';
import {
  ScrollView as GestureScrollView,
  type ScrollView,
} from 'react-native-gesture-handler';

export const APP_SCROLL_DEFAULTS = {
  keyboardShouldPersistTaps: 'handled' as const,
  keyboardDismissMode: 'on-drag' as const,
  nestedScrollEnabled: true,
};

export type AppScrollViewProps = ScrollViewProps;

export const AppScrollView = forwardRef<ScrollView, AppScrollViewProps>(function AppScrollView(
  props,
  ref,
) {
  return <GestureScrollView ref={ref} {...APP_SCROLL_DEFAULTS} {...props} />;
});

/** Pass to FlashList `renderScrollComponent` so list scrolling uses the gesture-handler ScrollView. */
export const FlashListScrollComponent = GestureScrollView;
