import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';
import type { FeedMediaItem } from '@/features/feed/types';

type Props = {
  media: FeedMediaItem[];
  onDoubleTap: () => void;
  onPressImage?: (index: number) => void;
};

type ImageTileProps = {
  item: FeedMediaItem;
  index: number;
  style?: object;
  onPressImage?: (index: number) => void;
  onDoubleTap: () => void;
  onShowHeart: () => void;
};

const ImageTile = memo(function ImageTile({
  item,
  index,
  style,
  onPressImage,
  onDoubleTap,
  onShowHeart,
}: ImageTileProps) {
  const { radius } = useTheme();

  const singleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(1)
        .onEnd(() => {
          if (onPressImage) runOnJS(onPressImage)(index);
        }),
    [index, onPressImage],
  );

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .onEnd((_e, success) => {
          if (!success) return;
          runOnJS(onShowHeart)();
          runOnJS(onDoubleTap)();
        }),
    [onDoubleTap, onShowHeart],
  );

  const gesture = useMemo(() => Gesture.Exclusive(doubleTap, singleTap), [doubleTap, singleTap]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ overflow: 'hidden' }, style]}>
        <Image
          source={{ uri: item.url }}
          recyclingKey={item.url}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={180}
          style={[styles.image, { borderRadius: radius.thumbnail, width: '100%', height: '100%' }]}
        />
      </Animated.View>
    </GestureDetector>
  );
});

export const FeedImageGrid = memo(function FeedImageGrid({ media, onDoubleTap, onPressImage }: Props) {
  const { colors, gap, radius } = useTheme();
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const limited = media.slice(0, 4);

  const showHeart = useCallback(() => {
    heartOpacity.value = 1;
    heartScale.value = 0.6;
    heartScale.value = withSequence(
      withSpring(1.18, { damping: 12, stiffness: 210 }),
      withSpring(1, { damping: 16, stiffness: 180 }),
    );
    heartOpacity.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(0, { duration: 260 }),
    );
  }, [heartOpacity, heartScale]);

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ scale: heartScale.value }],
  }));

  if (limited.length === 0) return null;

  return (
    <View style={[styles.wrap, { borderRadius: radius.card, gap: gap.xs }]}>
      {limited.length === 1 ? (
        <ImageTile
          item={limited[0]!}
          index={0}
          style={styles.single}
          onPressImage={onPressImage}
          onDoubleTap={onDoubleTap}
          onShowHeart={showHeart}
        />
      ) : limited.length === 2 ? (
        <View style={[styles.row, { gap: gap.xs }]}>
          <ImageTile
            item={limited[0]!}
            index={0}
            style={styles.half}
            onPressImage={onPressImage}
            onDoubleTap={onDoubleTap}
            onShowHeart={showHeart}
          />
          <ImageTile
            item={limited[1]!}
            index={1}
            style={styles.half}
            onPressImage={onPressImage}
            onDoubleTap={onDoubleTap}
            onShowHeart={showHeart}
          />
        </View>
      ) : limited.length === 3 ? (
        <View style={[styles.row, { gap: gap.xs }]}>
          <ImageTile
            item={limited[0]!}
            index={0}
            style={styles.largeSide}
            onPressImage={onPressImage}
            onDoubleTap={onDoubleTap}
            onShowHeart={showHeart}
          />
          <View style={[styles.stack, { gap: gap.xs }]}>
            <ImageTile
              item={limited[1]!}
              index={1}
              style={styles.stackTile}
              onPressImage={onPressImage}
              onDoubleTap={onDoubleTap}
              onShowHeart={showHeart}
            />
            <ImageTile
              item={limited[2]!}
              index={2}
              style={styles.stackTile}
              onPressImage={onPressImage}
              onDoubleTap={onDoubleTap}
              onShowHeart={showHeart}
            />
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.row, { gap: gap.xs }]}>
            <ImageTile
              item={limited[0]!}
              index={0}
              style={styles.halfGrid}
              onPressImage={onPressImage}
              onDoubleTap={onDoubleTap}
              onShowHeart={showHeart}
            />
            <ImageTile
              item={limited[1]!}
              index={1}
              style={styles.halfGrid}
              onPressImage={onPressImage}
              onDoubleTap={onDoubleTap}
              onShowHeart={showHeart}
            />
          </View>
          <View style={[styles.row, { gap: gap.xs }]}>
            <ImageTile
              item={limited[2]!}
              index={2}
              style={styles.halfGrid}
              onPressImage={onPressImage}
              onDoubleTap={onDoubleTap}
              onShowHeart={showHeart}
            />
            <ImageTile
              item={limited[3]!}
              index={3}
              style={styles.halfGrid}
              onPressImage={onPressImage}
              onDoubleTap={onDoubleTap}
              onShowHeart={showHeart}
            />
          </View>
        </>
      )}
      <Animated.View pointerEvents="none" style={[styles.heart, heartStyle]}>
        <Ionicons name="heart" size={78} color={colors.brand.red} />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
  },
  stack: {
    flex: 1,
  },
  image: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  single: {
    aspectRatio: 1.15,
    width: '100%',
  },
  half: {
    aspectRatio: 0.78,
    flex: 1,
  },
  largeSide: {
    aspectRatio: 0.78,
    flex: 1.2,
  },
  stackTile: {
    aspectRatio: 1.45,
    flex: 1,
    width: '100%',
  },
  halfGrid: {
    aspectRatio: 1.05,
    flex: 1,
  },
  heart: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
