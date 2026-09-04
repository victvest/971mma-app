import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { triggerLightImpact, triggerSelectionHaptic } from '@/shared/haptics';
import type { FeedMediaItem } from '@/features/feed/types';

type Props = {
  visible: boolean;
  media: FeedMediaItem[];
  initialIndex?: number;
  onClose: () => void;
};

type ZoomableImageProps = {
  item: FeedMediaItem;
  width: number;
  height: number;
  isCurrent: boolean;
  onDismiss: () => void;
  onToggleChrome: () => void;
  onZoomChange?: (isZoomed: boolean) => void;
};

const ZoomableImage = memo(function ZoomableImage({
  item,
  width,
  height,
  isCurrent,
  onDismiss,
  onToggleChrome,
  onZoomChange,
}: ZoomableImageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const dismissTranslateY = useSharedValue(0);

  const resetZoom = useCallback(() => {
    'worklet';
    scale.value = withSpring(1, { damping: 20, stiffness: 240 });
    savedScale.value = 1;
    translateX.value = withSpring(0, { damping: 20, stiffness: 240 });
    savedTranslateX.value = 0;
    translateY.value = withSpring(0, { damping: 20, stiffness: 240 });
    savedTranslateY.value = 0;
    dismissTranslateY.value = withSpring(0, { damping: 20, stiffness: 240 });
    if (onZoomChange) runOnJS(onZoomChange)(false);
  }, [dismissTranslateY, onZoomChange, savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY]);

  // Reset zoom when sliding to another image
  useEffect(() => {
    if (!isCurrent) {
      resetZoom();
    }
  }, [isCurrent, resetZoom]);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((e) => {
          const nextScale = Math.min(Math.max(savedScale.value * e.scale, 0.75), 5);
          scale.value = nextScale;
          if (onZoomChange) {
            runOnJS(onZoomChange)(nextScale > 1.05);
          }
        })
        .onEnd(() => {
          if (scale.value < 1.05) {
            resetZoom();
          } else {
            const clamped = Math.min(scale.value, 4.5);
            scale.value = withSpring(clamped, { damping: 18, stiffness: 200 });
            savedScale.value = clamped;
          }
        }),
    [onZoomChange, resetZoom, savedScale, scale],
  );

  // Vertical swipe down to dismiss when NOT zoomed (fails horizontally so swiping slides works seamlessly)
  const dismissPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([12, 12])
        .failOffsetX([-15, 15])
        .onUpdate((e) => {
          if (scale.value <= 1.05 && e.translationY > 0) {
            dismissTranslateY.value = e.translationY;
          }
        })
        .onEnd((e) => {
          if (scale.value <= 1.05) {
            if (e.translationY > 100 || e.velocityY > 650) {
              runOnJS(onDismiss)();
            } else {
              dismissTranslateY.value = withSpring(0, { damping: 20, stiffness: 250 });
            }
          }
        }),
    [dismissTranslateY, onDismiss, scale],
  );

  // Free 2D pan when zoomed in
  const zoomedPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(4)
        .onUpdate((e) => {
          if (scale.value > 1.05) {
            const maxBoundX = (width * (scale.value - 1)) / 2;
            const maxBoundY = (height * (scale.value - 1)) / 2;
            translateX.value = Math.min(
              Math.max(savedTranslateX.value + e.translationX, -maxBoundX * 1.3),
              maxBoundX * 1.3,
            );
            translateY.value = Math.min(
              Math.max(savedTranslateY.value + e.translationY, -maxBoundY * 1.3),
              maxBoundY * 1.3,
            );
          }
        })
        .onEnd(() => {
          if (scale.value > 1.05) {
            const maxBoundX = (width * (scale.value - 1)) / 2;
            const maxBoundY = (height * (scale.value - 1)) / 2;
            const targetX = Math.min(Math.max(translateX.value, -maxBoundX), maxBoundX);
            const targetY = Math.min(Math.max(translateY.value, -maxBoundY), maxBoundY);
            translateX.value = withSpring(targetX, { damping: 18, stiffness: 200 });
            savedTranslateX.value = targetX;
            translateY.value = withSpring(targetY, { damping: 18, stiffness: 200 });
            savedTranslateY.value = targetY;
          }
        }),
    [height, savedTranslateX, savedTranslateY, scale, translateX, translateY, width],
  );

  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
          if (scale.value > 1.2) {
            resetZoom();
          } else {
            scale.value = withSpring(2.5, { damping: 18, stiffness: 220 });
            savedScale.value = 2.5;
            if (onZoomChange) runOnJS(onZoomChange)(true);
          }
          runOnJS(triggerLightImpact)();
        }),
    [onZoomChange, resetZoom, savedScale, scale],
  );

  const singleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(1)
        .onEnd(() => {
          runOnJS(onToggleChrome)();
        }),
    [onToggleChrome],
  );

  const tapGestures = Gesture.Exclusive(doubleTapGesture, singleTapGesture);
  const activeGesture = Gesture.Simultaneous(
    pinchGesture,
    dismissPanGesture,
    zoomedPanGesture,
    tapGestures,
  );

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value + dismissTranslateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={[styles.imageSlide, { width, height }]}>
      <GestureDetector gesture={activeGesture}>
        <Animated.View style={[styles.imageWrap, animatedImageStyle]}>
          <Image
            source={{ uri: item.url }}
            recyclingKey={item.url}
            contentFit="contain"
            style={{ width, height: height * 0.82 }}
            transition={160}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

export const FeedImageViewerModal = memo(function FeedImageViewerModal({
  visible,
  media,
  initialIndex = 0,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showChrome, setShowChrome] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mounted, setMounted] = useState(visible);
  const flatListRef = useRef<FlatList<FeedMediaItem>>(null);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setCurrentIndex(initialIndex);
      setShowChrome(true);
      setIsZoomed(false);
      backdropOpacity.value = 0;
      backdropOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
      triggerLightImpact();
    } else if (mounted) {
      backdropOpacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }, (fin) => {
        if (fin) runOnJS(setMounted)(false);
      });
    }
  }, [backdropOpacity, initialIndex, mounted, visible]);

  useEffect(() => {
    if (visible && initialIndex > 0 && initialIndex < media.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [initialIndex, media.length, visible]);

  const handleClose = useCallback(() => {
    triggerSelectionHaptic();
    backdropOpacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }, (fin) => {
      if (fin) {
        runOnJS(setMounted)(false);
        runOnJS(onClose)();
      }
    });
  }, [backdropOpacity, onClose]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / width);
      if (index >= 0 && index < media.length && index !== currentIndex) {
        setCurrentIndex(index);
        setIsZoomed(false);
      }
    },
    [currentIndex, media.length, width],
  );

  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= media.length) return;
      triggerSelectionHaptic();
      setCurrentIndex(index);
      setIsZoomed(false);
      flatListRef.current?.scrollToIndex({ index, animated: true });
    },
    [media.length],
  );

  const toggleChrome = useCallback(() => {
    setShowChrome((v) => !v);
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const renderItem = useCallback(
    ({ item, index }: { item: FeedMediaItem; index: number }) => (
      <ZoomableImage
        item={item}
        width={width}
        height={height}
        isCurrent={index === currentIndex}
        onDismiss={handleClose}
        onToggleChrome={toggleChrome}
        onZoomChange={setIsZoomed}
      />
    ),
    [currentIndex, handleClose, height, toggleChrome, width],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  if (!mounted || media.length === 0) return null;

  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={mounted}
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Dark Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />

        {/* Carousel / Images */}
        <FlatList
          ref={flatListRef}
          data={media}
          horizontal
          pagingEnabled
          scrollEnabled={!isZoomed && media.length > 1}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          keyExtractor={(item, index) => item.id || item.url || String(index)}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialScrollIndex={initialIndex > 0 && initialIndex < media.length ? initialIndex : undefined}
          windowSize={3}
          decelerationRate="fast"
          removeClippedSubviews={false}
          style={styles.list}
        />

        {/* Top Floating Chrome */}
        {showChrome ? (
          <View
            pointerEvents="box-none"
            style={[styles.topChrome, { top: insets.top + 10, paddingHorizontal: 16 }]}
          >
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close image viewer"
              style={({ pressed }) => [styles.chromeButton, pressed && styles.chromeButtonPressed]}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>

            {media.length > 1 ? (
              <View style={styles.pageBadge}>
                <Text style={styles.pageText}>
                  {currentIndex + 1} / {media.length}
                </Text>
              </View>
            ) : null}

            <View style={styles.placeholder} />
          </View>
        ) : null}

        {/* Next / Previous Navigation Arrows */}
        {showChrome && !isZoomed && media.length > 1 ? (
          <>
            {currentIndex > 0 ? (
              <Pressable
                onPress={() => goToSlide(currentIndex - 1)}
                accessibilityRole="button"
                accessibilityLabel="Previous image"
                style={[styles.navArrow, styles.navArrowLeft]}
              >
                <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
              </Pressable>
            ) : null}

            {currentIndex < media.length - 1 ? (
              <Pressable
                onPress={() => goToSlide(currentIndex + 1)}
                accessibilityRole="button"
                accessibilityLabel="Next image"
                style={[styles.navArrow, styles.navArrowRight]}
              >
                <Ionicons name="chevron-forward" size={26} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </>
        ) : null}

        {/* Bottom Indicator Dots */}
        {showChrome && media.length > 1 ? (
          <View style={[styles.bottomDots, { bottom: insets.bottom + 16 }]}>
            {media.map((_, idx) => (
              <Pressable
                key={idx}
                onPress={() => goToSlide(idx)}
                style={[
                  styles.dot,
                  idx === currentIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backdrop: {
    backgroundColor: '#000000',
  },
  list: {
    flex: 1,
  },
  imageSlide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },
  chromeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  chromeButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  pageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pageText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  placeholder: {
    width: 40,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
  navArrowLeft: {
    left: 12,
  },
  navArrowRight: {
    right: 12,
  },
  bottomDots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 100,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: '#FFFFFF',
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
});
