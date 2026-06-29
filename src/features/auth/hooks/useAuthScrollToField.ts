import { useCallback, useRef } from 'react';
import { Platform, type ScrollView, type View } from 'react-native';

const FIELD_BOTTOM_BUFFER = 120;
const SCROLL_RETRY_DELAYS_MS = Platform.OS === 'ios' ? [0, 120, 280, 480] : [0, 80, 200, 400];

type ScrollToFieldOptions = {
  keyboardHeight: number;
  windowHeight: number;
  contentPaddingTop: number;
};

export function useAuthScrollToField(
  scrollRef: React.RefObject<ScrollView | null>,
  scrollContentRef: React.RefObject<View | null>,
  { keyboardHeight, windowHeight, contentPaddingTop }: ScrollToFieldOptions,
) {
  const scrollOffsetY = useRef(0);

  const onScrollOffsetChange = useCallback((offsetY: number) => {
    scrollOffsetY.current = offsetY;
  }, []);

  const scrollFieldIntoView = useCallback(
    (fieldRef: React.RefObject<View | null>) => {
      const scrollView = scrollRef.current;
      const scrollContent = scrollContentRef.current;
      const field = fieldRef.current;
      if (!scrollView || !scrollContent || !field || keyboardHeight === 0) return;

      const runScroll = () => {
        field.measureLayout(
          scrollContent,
          (_x, y, _width, height) => {
            const visibleHeight =
              Platform.OS === 'ios'
                ? windowHeight - keyboardHeight - contentPaddingTop
                : windowHeight - contentPaddingTop;

            const fieldBottomInContent = contentPaddingTop + y + height + FIELD_BOTTOM_BUFFER;
            const scrollTarget = fieldBottomInContent - visibleHeight;

            if (scrollTarget > scrollOffsetY.current) {
              scrollView.scrollTo({ y: scrollTarget, animated: true });
            }
          },
          () => {
            field.measureInWindow((_x, windowY, _width, fieldHeight) => {
              const visibleBottom =
                Platform.OS === 'ios'
                  ? windowHeight - keyboardHeight
                  : windowHeight;

              const fieldBottom = windowY + fieldHeight + FIELD_BOTTOM_BUFFER;
              if (fieldBottom > visibleBottom) {
                scrollView.scrollTo({
                  y: scrollOffsetY.current + (fieldBottom - visibleBottom),
                  animated: true,
                });
              }
            });
          },
        );
      };

      SCROLL_RETRY_DELAYS_MS.forEach((delay) => {
        if (delay === 0) {
          requestAnimationFrame(runScroll);
          return;
        }
        setTimeout(runScroll, delay);
      });
    },
    [contentPaddingTop, keyboardHeight, scrollContentRef, scrollRef, windowHeight],
  );

  return { scrollFieldIntoView, onScrollOffsetChange };
}
