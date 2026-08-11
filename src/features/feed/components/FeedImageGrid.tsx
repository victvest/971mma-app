import React, { memo, useMemo } from 'react';
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
};

type ImageTileProps = {
  item: FeedMediaItem;
  style?: object;
};

const ImageTile = memo(function ImageTile({ item, style }: ImageTileProps) {
  const { radius } = useTheme();
  return (
    <Image
      source={{ uri: item.url }}
      recyclingKey={item.url}
      cachePolicy="memory-disk"
      contentFit="cover"
      transition={180}
      style={[styles.image, { borderRadius: radius.thumbnail }, style]}
    />
  );
});

export const FeedImageGrid = memo(function FeedImageGrid({ media, onDoubleTap }: Props) {
  const { colors, gap, radius } = useTheme();
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const limited = media.slice(0, 4);

  const showHeart = () => {
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
  };

  const gesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .onEnd((_event, success) => {
          if (!success) return;
          runOnJS(showHeart)();
          runOnJS(onDoubleTap)();
        }),
    [onDoubleTap],
  );

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ scale: heartScale.value }],
  }));

  if (limited.length === 0) return null;

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.wrap, { borderRadius: radius.card, gap: gap.xs }]}>
        {limited.length === 1 ? (
          <ImageTile item={limited[0]!} style={styles.single} />
        ) : limited.length === 2 ? (
          <View style={[styles.row, { gap: gap.xs }]}>
            <ImageTile item={limited[0]!} style={styles.half} />
            <ImageTile item={limited[1]!} style={styles.half} />
          </View>
        ) : limited.length === 3 ? (
          <View style={[styles.row, { gap: gap.xs }]}>
            <ImageTile item={limited[0]!} style={styles.largeSide} />
            <View style={[styles.stack, { gap: gap.xs }]}>
              <ImageTile item={limited[1]!} style={styles.stackTile} />
              <ImageTile item={limited[2]!} style={styles.stackTile} />
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.row, { gap: gap.xs }]}>
              <ImageTile item={limited[0]!} style={styles.halfGrid} />
              <ImageTile item={limited[1]!} style={styles.halfGrid} />
            </View>
            <View style={[styles.row, { gap: gap.xs }]}>
              <ImageTile item={limited[2]!} style={styles.halfGrid} />
              <ImageTile item={limited[3]!} style={styles.halfGrid} />
            </View>
          </>
        )}
        <Animated.View pointerEvents="none" style={[styles.heart, heartStyle]}>
          <Ionicons name="heart" size={78} color={colors.brand.red} />
        </Animated.View>
      </View>
    </GestureDetector>
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
