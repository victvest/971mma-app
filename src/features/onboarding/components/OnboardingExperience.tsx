import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  type EntryOrExitLayoutType,
} from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';
import { AppScrollView } from '@/shared/components/ui';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { useTheme } from '@/shared/theme';
import { useAuthEntranceAnimation } from '@/features/auth/hooks/useAuthEntranceAnimation';
import authBrandMark from '../../../../assets/brand/971-logo-black.png';

const AnimatedView = Animated.createAnimatedComponent(View);

type OnboardingScreenProps = {
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  controls?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  entering: EntryOrExitLayoutType;
  exiting: EntryOrExitLayoutType;
  /** When true, omits logo/status bar and uses compact padding for nested screens. */
  embedded?: boolean;
};

export function OnboardingScreen({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  controls,
  onBack,
  backLabel = 'Back',
  entering,
  exiting,
  embedded = false,
}: OnboardingScreenProps) {
  const { colors, typography, inset, gap, layout } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const headerStyle = useAuthEntranceAnimation();

  return (
    <View style={[styles.root, { backgroundColor: colors.background.primary }]}>
      {!embedded ? <AppStatusBar backgroundColor={colors.background.primary} /> : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={embedded ? 0 : safeInsets.top}
      >
        <AppScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: embedded ? inset.md : safeInsets.top + inset.md,
              paddingBottom: embedded ? inset.lg : safeInsets.bottom + inset.xl,
              paddingHorizontal: inset.lg,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.panelWrap,
              {
                maxWidth: layout.authContentMaxWidth,
                gap: gap.xl,
              },
            ]}
          >
            {!embedded ? (
              <AnimatedView style={[styles.logoWrap, headerStyle]}>
                <Image
                  source={authBrandMark}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  style={{
                    width: layout.authBrandMark * 0.82,
                    height: layout.authBrandMark * 0.82,
                    tintColor: colors.text.primary,
                  }}
                />
              </AnimatedView>
            ) : null}

            <View style={[styles.progressRow, { gap: gap.xs }]}>
              {Array.from({ length: totalSteps }, (_, index) => {
                const active = index <= step;
                return (
                  <View
                    key={index}
                    style={[
                      styles.progressSegment,
                      {
                        backgroundColor: active ? colors.accent.default : colors.fill.secondary,
                      },
                    ]}
                  />
                );
              })}
            </View>

            <AnimatedView
              key={`onboarding-copy-${step}`}
              entering={entering}
              exiting={exiting}
              style={{ gap: gap.sm }}
            >
              <Text
                style={{
                  ...typography.textPresets.authTitle,
                  fontSize: 32,
                  lineHeight: 36,
                  color: colors.text.primary,
                  textAlign: 'center',
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  ...typography.textPresets.body,
                  color: colors.text.secondary,
                  textAlign: 'center',
                }}
              >
                {subtitle}
              </Text>
            </AnimatedView>

            <AnimatedView
              key={`onboarding-body-${step}`}
              entering={entering}
              exiting={exiting}
              style={[
                styles.stepContentStage,
                {
                  gap: gap.md,
                  minHeight: layout.authBrandMark * 1.85,
                },
              ]}
            >
              {children}
            </AnimatedView>

            {controls ? <View style={[styles.controlsWrap, { gap: gap.md }]}>{controls}</View> : null}

            {onBack ? (
              <OnboardingStepBack label={backLabel} onPress={onBack} />
            ) : null}
          </View>
        </AppScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type OnboardingStepBackProps = {
  label: string;
  onPress: () => void;
};

export function OnboardingStepBack({ label, onPress }: OnboardingStepBackProps) {
  const { colors, typography, gap, inset } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: gap.xs,
        paddingVertical: inset.xs,
        alignSelf: 'center',
      }}
    >
      <ArrowLeft size={16} color={colors.accent.default} strokeWidth={2.5} />
      <Text style={[typography.textPresets.bodyStrong, { color: colors.accent.default }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  panelWrap: {
    width: '100%',
    alignSelf: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    width: '100%',
  },
  progressRow: {
    flexDirection: 'row',
    width: '100%',
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
  },
  stepContentStage: {
    justifyContent: 'center',
    width: '100%',
  },
  controlsWrap: {
    width: '100%',
  },
});
