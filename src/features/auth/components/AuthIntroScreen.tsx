import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  openAuthLoginFromIntro,
  openAuthRegisterFromIntro,
} from '@/features/auth/navigation/authNavigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/theme';
import {
  useAuthEntranceAnimation,
  useAuthSlideUpAnimation,
} from '@/features/auth/hooks/useAuthEntranceAnimation';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { UaeBrandAmbientGlow } from '@/shared/components/brand';
import authBrandMark from '../../../../assets/brand/971-logo-official.webp';
import introSlidePrimary from '../../../../assets/images/optimized/hero-nlbjj-card.jpg';
import introSlideCoaches from '../../../../assets/images/optimized/academy-team-card.jpg';
import introSlideRewards from '../../../../assets/images/optimized/discipline-boxing-card.jpg';

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type IntroSlide = {
  key: string;
  source: number;
  title: string;
  description: string;
};

const INTRO_SLIDES: IntroSlide[] = [
  {
    key: 'intro-schedule',
    source: introSlidePrimary,
    title: 'Explore Programs',
    description: 'Browse the full class schedule across BJJ, Muay Thai, boxing, and MMA.',
  },
  {
    key: 'intro-coaches',
    source: introSlideCoaches,
    title: 'Discover Coaches',
    description: 'Meet the academy team and see who is teaching each session.',
  },
  {
    key: 'intro-rewards',
    source: introSlideRewards,
    title: 'Earn By Attending',
    description: 'Check in, build streaks, unlock rewards, and track your progression.',
  },
];

const STORY_ADVANCE_INTERVALS = 8;
const INTRO_SHEET_OVERLAP = 28;

function getIntroLayoutMetrics(windowHeight: number) {
  const isCompact = windowHeight < 740;

  return {
    isCompact,
    titleSize: isCompact ? 26 : 30,
    titleLineHeight: isCompact ? 30 : 34,
    descriptionSize: isCompact ? 14 : 16,
    logoScale: isCompact ? 0.95 : 1.1,
  };
}

type MediaTopScrimProps = {
  topInset: number;
};

function MediaTopScrim({ topInset }: MediaTopScrimProps) {
  const topScrimHeight = topInset + 56;

  return (
    <LinearGradient
      colors={['rgba(0,0,0,0.34)', 'rgba(0,0,0,0.12)', 'transparent']}
      locations={[0, 0.45, 1]}
      style={[styles.mediaTopScrim, { height: topScrimHeight }]}
      pointerEvents="none"
    />
  );
}

type IntroActionButtonProps = {
  label: string;
  onPress: () => void;
  variant: 'primary' | 'outline';
};

function IntroActionButton({ label, onPress, variant }: IntroActionButtonProps) {
  const { colors, typography, layout, radius, animations } = useTheme();
  const scale = useSharedValue<number>(animations.scale.resting);
  const isPrimary = variant === 'primary';

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(animations.scale.pressed, animations.spring.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(animations.scale.resting, animations.spring.snappy);
      }}
      style={[
        styles.introButton,
        {
          minHeight: layout.authButtonHeight,
          borderRadius: radius.button,
          borderWidth: 1.5,
          backgroundColor: isPrimary ? colors.accent.default : 'transparent',
          borderColor: isPrimary ? colors.accent.default : colors.border.default,
        },
        pressStyle,
      ]}
    >
      <Text
        style={{
          ...typography.textPresets.button,
          color: isPrimary ? colors.accent.onAccent : colors.text.primary,
        }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

type StorySlideProps = {
  slide: IntroSlide;
  active: boolean;
  width: number;
  height: number;
};

function StorySlide({ slide, active, width, height }: StorySlideProps) {
  const { colors } = useTheme();

  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: colors.background.primary }}>
      <ExpoImage
        source={slide.source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
        cachePolicy="memory-disk"
        priority={active ? 'high' : 'normal'}
        recyclingKey={slide.key}
        transition={300}
      />
      <UaeBrandAmbientGlow variant="photo-card" />
    </View>
  );
}

type StoryCaptionProps = {
  slide: IntroSlide;
  titleSize: number;
  titleLineHeight: number;
  descriptionSize: number;
};

function StoryCaption({ slide, titleSize, titleLineHeight, descriptionSize }: StoryCaptionProps) {
  const { colors, gap, layout, animations, fontWeight, resolveFontFamily } = useTheme();
  const opacity = useSharedValue<number>(animations.alpha.hidden);
  const translateY = useSharedValue<number>(layout.authEntranceOffset);

  useEffect(() => {
    opacity.value = animations.alpha.hidden;
    translateY.value = layout.authEntranceOffset;
    opacity.value = withTiming(animations.alpha.visible, animations.timing.page);
    translateY.value = withSpring(animations.interactionState.idle, animations.spring.slow);
  }, [
    animations.alpha.hidden,
    animations.alpha.visible,
    animations.interactionState.idle,
    animations.spring.slow,
    animations.timing.page,
    layout.authEntranceOffset,
    opacity,
    slide.key,
    translateY,
  ]);

  const captionStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <AnimatedView style={[{ flex: 1, gap: gap.xs }, captionStyle]}>
      <Text
        style={{
          fontFamily: resolveFontFamily('display', fontWeight.black),
          fontSize: titleSize,
          fontWeight: '400',
          letterSpacing: -0.8,
          lineHeight: titleLineHeight,
          color: colors.text.primary,
        }}
      >
        {slide.title}
      </Text>
      <Text
        style={{
          fontFamily: resolveFontFamily('body', fontWeight.medium),
          fontSize: descriptionSize,
          fontWeight: '400',
          lineHeight: descriptionSize + 7,
          letterSpacing: -0.2,
          color: colors.text.secondary,
        }}
      >
        {slide.description}
      </Text>
    </AnimatedView>
  );
}

type StoryProgressBarProps = {
  index: number;
  activeIndex: number;
  durationMs: number;
};

function StoryProgressBar({ index, activeIndex, durationMs }: StoryProgressBarProps) {
  const { radius, spacing } = useTheme();
  const progress = useSharedValue<number>(index < activeIndex ? 1 : 0);

  useEffect(() => {
    cancelAnimation(progress);

    if (index < activeIndex) {
      progress.value = 1;
      return;
    }

    if (index > activeIndex) {
      progress.value = 0;
      return;
    }

    progress.value = 0;
    progress.value = withTiming(1, {
      duration: durationMs,
      easing: Easing.linear,
    });
  }, [activeIndex, durationMs, index, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View
      style={[
        styles.progressTrack,
        {
          height: spacing[1],
          borderRadius: radius.pill,
          backgroundColor: 'rgba(255,255,255,0.28)',
        },
      ]}
    >
      <AnimatedView
        style={[
          styles.progressFill,
          { borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
          fillStyle,
        ]}
      />
    </View>
  );
}

export function AuthIntroScreen() {
  const safeInsets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { colors, inset, gap, layout, animations, radius, shadows } = useTheme();
  const listRef = useRef<FlatList<IntroSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mediaRegionHeight, setMediaRegionHeight] = useState(0);
  const activeSlide = INTRO_SLIDES[activeIndex] ?? INTRO_SLIDES[0];

  const layoutMetrics = getIntroLayoutMetrics(windowHeight);
  const { isCompact, titleSize, titleLineHeight, descriptionSize, logoScale } = layoutMetrics;
  const introLogoSize = Math.round(layout.authIntroLogoSize * logoScale);
  const storySlideHeight = mediaRegionHeight > 0 ? mediaRegionHeight : Math.round(windowHeight * 0.62);
  const storyDurationMs = animations.duration.crawl * STORY_ADVANCE_INTERVALS;
  const panelBackground = colors.background.primary;

  const logoStyle = useAuthEntranceAnimation();
  const loginButtonStyle = useAuthSlideUpAnimation({ delay: animations.duration.base });
  const signUpButtonStyle = useAuthSlideUpAnimation({
    delay: animations.duration.base + animations.stagger.base,
  });

  const goToSlide = useCallback(
    (index: number) => {
      const nextIndex = (index + INTRO_SLIDES.length) % INTRO_SLIDES.length;
      setActiveIndex(nextIndex);
      listRef.current?.scrollToOffset({
        offset: nextIndex * windowWidth,
        animated: true,
      });
    },
    [windowWidth],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      goToSlide(activeIndex + 1);
    }, storyDurationMs);

    return () => clearInterval(timer);
  }, [activeIndex, goToSlide, storyDurationMs]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
      setActiveIndex(index);
    },
    [windowWidth],
  );

  const renderSlide = useCallback(
    ({ item, index }: ListRenderItemInfo<IntroSlide>) => (
      <StorySlide slide={item} active={index === activeIndex} width={windowWidth} height={storySlideHeight} />
    ),
    [activeIndex, storySlideHeight, windowWidth],
  );

  const handleMediaRegionLayout = useCallback((height: number) => {
    setMediaRegionHeight((current) => (current === height ? current : height));
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: panelBackground }]}>
      <AppStatusBar backgroundColor={panelBackground} />

      <View
        style={[styles.mediaRegion, { flex: 1 }]}
        onLayout={(event) => handleMediaRegionLayout(event.nativeEvent.layout.height)}
      >
        <FlatList
          ref={listRef}
          data={INTRO_SLIDES}
          horizontal
          pagingEnabled
          bounces={false}
          decelerationRate="fast"
          removeClippedSubviews={false}
          showsHorizontalScrollIndicator={false}
          style={StyleSheet.absoluteFill}
          keyExtractor={(item) => item.key}
          renderItem={renderSlide}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={(_, index) => ({
            length: windowWidth,
            offset: windowWidth * index,
            index,
          })}
        />

        <MediaTopScrim topInset={safeInsets.top} />

        <View
          style={[
            styles.progressRow,
            {
              gap: gap.xs,
              paddingHorizontal: inset.md,
              paddingTop: safeInsets.top + inset.sm,
            },
          ]}
          pointerEvents="none"
        >
          {INTRO_SLIDES.map((_, index) => (
            <StoryProgressBar
              key={`story-progress-${index}`}
              index={index}
              activeIndex={activeIndex}
              durationMs={storyDurationMs}
            />
          ))}
        </View>
      </View>

      <View
        style={[
          styles.panel,
          shadows.card,
          {
            marginTop: -INTRO_SHEET_OVERLAP,
            backgroundColor: panelBackground,
            borderTopLeftRadius: radius.cardLarge,
            borderTopRightRadius: radius.cardLarge,
            paddingHorizontal: inset.lg,
            paddingTop: inset.sm + 10,
            paddingBottom: Math.max(safeInsets.bottom, inset.xs),
          },
        ]}
      >
        <View style={[styles.panelContent, { gap: isCompact ? gap.sm : gap.md }]}>
          <AnimatedView style={[styles.captionRow, { gap: gap.md }, logoStyle]}>
            <ExpoImage
              source={authBrandMark}
              contentFit="contain"
              cachePolicy="memory-disk"
              style={{
                width: introLogoSize,
                height: introLogoSize,
                tintColor: colors.text.primary,
              }}
            />
            <StoryCaption
              slide={activeSlide}
              titleSize={titleSize}
              titleLineHeight={titleLineHeight}
              descriptionSize={descriptionSize}
            />
          </AnimatedView>

          <View style={[styles.actions, { gap: isCompact ? gap.sm : gap.md }]}>
            <AnimatedView style={loginButtonStyle}>
              <IntroActionButton
                label="Log In"
                variant="primary"
                onPress={openAuthLoginFromIntro}
              />
            </AnimatedView>

            <AnimatedView style={signUpButtonStyle}>
              <IntroActionButton
                label="Sign Up"
                variant="outline"
                onPress={openAuthRegisterFromIntro}
              />
            </AnimatedView>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mediaRegion: {
    overflow: 'hidden',
    position: 'relative',
  },
  mediaTopScrim: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  progressRow: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
    flexDirection: 'row',
  },
  progressTrack: {
    flex: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  panel: {
    flexShrink: 0,
    zIndex: 2,
  },
  panelContent: {
    width: '100%',
  },
  actions: {
    flexShrink: 0,
  },
  introButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  captionRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
