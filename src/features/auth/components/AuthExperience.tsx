import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from 'react-native';
import { Image } from 'expo-image';
import { OtpInput, type OtpInputRef } from 'react-native-otp-entry';
import { AppBarBackButton } from '@/shared/components/ui';
import { MotiPressable } from '@/shared/animations';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  type LucideProps,
} from 'lucide-react-native';
import { type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/theme';
import {
  useAuthEntranceAnimation,
  useAuthSlideUpAnimation,
} from '@/features/auth/hooks/useAuthEntranceAnimation';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import {
  applyEmailDomainSuggestion,
  getPasswordRules,
  shouldShowEmailDomainSuggestion,
} from '@/features/auth/services/authValidation';
import type { AuthNavigateMode } from '@/features/auth/navigation/authNavigation';
import { navigateAuth } from '@/features/auth/navigation/authNavigation';
import { NAV_CHROME } from '@/features/home/components/navigation/uaeChrome';
import authBrandMark from '../../../../assets/brand/logo-notext.png';
import { GoogleLogo } from '@/features/auth/components/GoogleLogo';
import { useAuthScrollToField } from '@/features/auth/hooks/useAuthScrollToField';
import { useKeyboardBottomInset } from '@/shared/hooks';

type AuthScrollContextValue = {
  scrollFieldIntoView: (fieldRef: RefObject<View | null>) => void;
};

const AuthScrollContext = createContext<AuthScrollContextValue | null>(null);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedView = Animated.createAnimatedComponent(View);

type AuthIcon = ComponentType<LucideProps>;
type AuthAnimatedStyle = ReturnType<typeof useAuthEntranceAnimation>;

const AUTH_ICON_SIZE = 20;
const AUTH_ICON_STROKE = 2;
const PASSWORD_RULE_SEGMENT_HEIGHT = 4;
const AUTH_LOGO_COMPACT_SCALE = 0.7;
const AUTH_LOGO_REGULAR_SCALE = 0.86;

type AuthScreenProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  showBackButton?: boolean;
  onBackPress?: () => void;
};

export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
  showBackButton = false,
  onBackPress,
}: AuthScreenProps) {
  const { colors, typography, inset, gap, layout, animations } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const keyboardBottomInset = useKeyboardBottomInset();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const compactHeight = windowHeight < layout.authCompactHeight;
  const contentPaddingTop = safeInsets.top + (showBackButton ? inset['3xl'] : inset.xl);
  const scrollPaddingBottom = safeInsets.bottom + (compactHeight ? inset.xl : inset['3xl']);
  const panelGap = compactHeight ? gap.lg : gap.xl;
  const logoSize =
    layout.authBrandMark * (compactHeight ? AUTH_LOGO_COMPACT_SCALE : AUTH_LOGO_REGULAR_SCALE);

  const { scrollFieldIntoView, onScrollOffsetChange } = useAuthScrollToField(
    scrollRef,
    scrollContentRef,
    {
      keyboardHeight: keyboardBottomInset,
      windowHeight,
      contentPaddingTop,
    },
  );

  const headerStyle = useAuthEntranceAnimation();
  const bodyStyle = useAuthSlideUpAnimation({ delay: animations.duration.instant });
  const footerStyle = useAuthEntranceAnimation({
    delay: animations.duration.base + animations.stagger.base,
  });

  return (
    <AuthScrollContext.Provider value={{ scrollFieldIntoView }}>
      <View style={[styles.root, { backgroundColor: colors.background.primary }]}>
        <AppStatusBar backgroundColor={colors.background.primary} />
        {showBackButton && onBackPress ? (
          <View
            style={[
              styles.backButtonRoot,
              {
                top: safeInsets.top + NAV_CHROME.topInset,
                left: NAV_CHROME.horizontalInset,
              },
            ]}
            pointerEvents="box-none"
          >
            <AppBarBackButton onPress={onBackPress} />
          </View>
        ) : null}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            nestedScrollEnabled
            onScroll={(event) => {
              onScrollOffsetChange(event.nativeEvent.contentOffset.y);
            }}
            scrollEventThrottle={16}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: contentPaddingTop,
                paddingHorizontal: inset.lg,
                paddingBottom: scrollPaddingBottom,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View
              ref={scrollContentRef}
              style={[
                styles.panelWrap,
                {
                  maxWidth: layout.authContentMaxWidth,
                  gap: panelGap,
                },
              ]}
            >
              <AuthBrandMark
                size={logoSize}
                tintColor={colors.text.primary}
                animatedStyle={headerStyle}
              />

              <AnimatedView style={[styles.copyBlock, { gap: gap.sm }, headerStyle]}>
                <Text
                  style={{
                    ...typography.textPresets.authTitle,
                    fontSize: 34,
                    lineHeight: 38,
                    letterSpacing: 0,
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

              <AnimatedView style={[styles.formStack, { gap: gap.md }, bodyStyle]}>
                {children}
              </AnimatedView>

              {footer ? (
                <AnimatedView style={[styles.footerStack, { gap: gap.sm }, footerStyle]}>
                  {footer}
                </AnimatedView>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </AuthScrollContext.Provider>
  );
}

function AuthBrandMark({
  size,
  tintColor,
  animatedStyle,
}: {
  size: number;
  tintColor: string;
  animatedStyle: AuthAnimatedStyle;
}) {
  return (
    <AnimatedView style={[styles.logoWrap, animatedStyle]}>
      <Image
        source={authBrandMark}
        contentFit="contain"
        cachePolicy="memory-disk"
        style={{
          width: size,
          height: size,
          tintColor,
        }}
      />
    </AnimatedView>
  );
}

type AuthTextFieldProps = TextInputProps & {
  label: string;
  icon: AuthIcon;
  password?: boolean;
  hasError?: boolean;
  showPasswordRules?: boolean;
  onDomainSuggestionApplied?: () => void;
};

export const AuthTextField = forwardRef<TextInput, AuthTextFieldProps>(function AuthTextField(
  {
    label,
    icon: Icon,
    password,
    hasError,
    showPasswordRules = false,
    onFocus,
    onBlur,
    onChangeText,
    onDomainSuggestionApplied,
    style,
    value,
    ...rest
  },
  ref,
) {
  const { colors, typography, inset, gap, layout, radius } = useTheme();
  const authScroll = useContext(AuthScrollContext);
  const keyboardBottomInset = useKeyboardBottomInset();
  const fieldBlockRef = useRef<View>(null);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(password));

  const textValue = typeof value === 'string' ? value : '';
  const isEmailField =
    rest.keyboardType === 'email-address' ||
    rest.autoComplete === 'email' ||
    rest.textContentType === 'emailAddress';
  const showDomainSuggestion =
    isEmailField && !password && shouldShowEmailDomainSuggestion(textValue);
  const passwordRules = getPasswordRules(textValue);
  const passwordRuleMet = [
    passwordRules.minLength,
    passwordRules.hasLetter,
    passwordRules.hasNumber,
  ];

  const iconColor = hasError
    ? colors.status.error
    : focused
      ? colors.accent.default
      : colors.text.tertiary;

  function handleDomainSuggestionPress() {
    const nextEmail = applyEmailDomainSuggestion(textValue);
    onChangeText?.(nextEmail);
    onDomainSuggestionApplied?.();
  }

  function handleFocus(event: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) {
    setFocused(true);
    onFocus?.(event);
    authScroll?.scrollFieldIntoView(fieldBlockRef);
  }

  useEffect(() => {
    if (!focused || keyboardBottomInset === 0) return;
    authScroll?.scrollFieldIntoView(fieldBlockRef);
  }, [authScroll, focused, keyboardBottomInset]);

  return (
    <View ref={fieldBlockRef} style={{ gap: gap.xs }}>
      <Text
        style={{
          ...typography.textPresets.label,
          color: colors.text.secondary,
          marginBottom: 2,
          fontWeight: '800',
        }}
      >
        {label}
      </Text>
      <View
        style={[
          styles.field,
          {
            height: layout.authFieldHeight,
            paddingHorizontal: inset.md,
            borderRadius: radius.input,
            borderWidth: 1.2,
            borderColor: hasError
              ? colors.status.error
              : focused
                ? colors.accent.default
                : colors.border.subtle,
            backgroundColor: hasError
              ? colors.status.errorSubtle
              : focused
                ? colors.background.elevated
                : colors.background.secondary,
            gap: gap.sm,
          },
        ]}
      >
        <Icon size={AUTH_ICON_SIZE} color={iconColor} strokeWidth={AUTH_ICON_STROKE} />
        <TextInput
          ref={ref}
          style={[
            styles.input,
            typography.textPresets.bodyMedium,
            { color: colors.text.primary, paddingVertical: 0 },
            style,
          ]}
          placeholderTextColor={colors.text.tertiary}
          cursorColor={colors.accent.default}
          selectionColor={colors.accent.default}
          secureTextEntry={hidden}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />
        {showDomainSuggestion ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use @gmail.com"
            hitSlop={inset.xs}
            onPress={handleDomainSuggestionPress}
          >
            <Text
              style={{
                ...typography.textPresets.bodyStrong,
                color: colors.accent.default,
                fontWeight: '700',
              }}
            >
              @gmail.com
            </Text>
          </Pressable>
        ) : null}
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((current) => !current)}
            hitSlop={inset.sm}
          >
            {hidden ? (
              <Eye
                size={AUTH_ICON_SIZE}
                color={colors.text.tertiary}
                strokeWidth={AUTH_ICON_STROKE}
              />
            ) : (
              <EyeOff
                size={AUTH_ICON_SIZE}
                color={colors.text.tertiary}
                strokeWidth={AUTH_ICON_STROKE}
              />
            )}
          </Pressable>
        ) : null}
      </View>
      {showPasswordRules ? (
        <AuthPasswordRuleMeter active={textValue.length > 0} rules={passwordRuleMet} />
      ) : null}
    </View>
  );
});

function AuthPasswordRuleMeter({ active, rules }: { active: boolean; rules: boolean[] }) {
  const { colors, gap } = useTheme();

  return (
    <View
      accessibilityLabel="Password strength"
      accessibilityValue={{ text: `${rules.filter(Boolean).length} of ${rules.length} rules met` }}
      style={[styles.passwordRuleMeter, { gap: gap.xs }]}
    >
      {rules.map((isMet, index) => (
        <View
          key={index}
          style={[
            styles.passwordRuleSegment,
            {
              backgroundColor: !active
                ? colors.border.default
                : isMet
                  ? colors.accent.default
                  : colors.status.error,
            },
          ]}
        />
      ))}
    </View>
  );
}

type AuthOtpInputProps = {
  onChange: (code: string) => void;
  onFilled?: (code: string) => void;
  disabled?: boolean;
};

export const AuthOtpInput = forwardRef<OtpInputRef, AuthOtpInputProps>(function AuthOtpInput(
  { onChange, onFilled, disabled },
  ref,
) {
  const { colors, typography, radius, layout, gap } = useTheme();

  return (
    <OtpInput
      ref={ref}
      numberOfDigits={6}
      type="numeric"
      autoFocus
      disabled={disabled}
      focusColor={colors.accent.default}
      onTextChange={onChange}
      onFilled={onFilled}
      textInputProps={{
        textContentType: 'oneTimeCode',
        autoComplete: 'one-time-code',
      }}
      theme={{
        containerStyle: {
          width: '100%',
          justifyContent: 'center',
          gap: gap.sm,
        },
        pinCodeContainerStyle: {
          flex: 1,
          maxWidth: 52,
          height: layout.authFieldHeight,
          borderWidth: 1.2,
          borderColor: colors.border.subtle,
          borderRadius: radius.input,
          backgroundColor: colors.background.secondary,
        },
        focusedPinCodeContainerStyle: {
          borderColor: colors.accent.default,
          backgroundColor: colors.background.elevated,
        },
        filledPinCodeContainerStyle: {
          borderColor: colors.border.default,
          backgroundColor: colors.background.elevated,
        },
        pinCodeTextStyle: {
          ...typography.textPresets.bodyMedium,
          fontSize: 20,
          fontWeight: '700',
          color: colors.text.primary,
        },
        focusStickStyle: {
          backgroundColor: colors.accent.default,
          height: 22,
          width: 2,
        },
      }}
    />
  );
});

type AuthGoogleButtonProps = {
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function AuthGoogleButton({ onPress, loading, disabled }: AuthGoogleButtonProps) {
  const { colors, typography, inset, gap, layout, radius, animations } = useTheme();
  const scale = useSharedValue<number>(animations.scale.resting);
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const borderColor = colors.border.subtle;
  const backgroundColor = inactive
    ? colors.background.secondary
    : pressed
      ? colors.background.elevated
      : colors.background.secondary;
  const foreground = inactive ? colors.text.tertiary : colors.text.primary;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => {
        if (!inactive) {
          setPressed(true);
          scale.value = withSpring(animations.scale.pressed, animations.spring.snappy);
        }
      }}
      onPressOut={() => {
        setPressed(false);
        scale.value = withSpring(animations.scale.resting, animations.spring.snappy);
      }}
      style={[
        styles.googleButton,
        {
          minHeight: layout.authButtonHeight,
          paddingHorizontal: inset.lg,
          borderRadius: radius.button,
          borderWidth: 1.2,
          borderColor,
          backgroundColor,
          gap: gap.sm,
        },
        buttonStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <View style={[styles.googleContent, { gap: gap.sm }]}>
          <GoogleLogo size={20} />
          <Text
            style={{
              ...typography.textPresets.button,
              fontSize: 16,
              fontWeight: '800',
              color: foreground,
            }}
          >
            Continue with Google
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

export function AuthOrDivider() {
  const { colors, typography, inset } = useTheme();

  return (
    <View style={styles.orDivider}>
      <View style={[styles.orDividerLine, { backgroundColor: colors.border.default }]} />
      <Text
        style={{
          ...typography.textPresets.label,
          color: colors.text.secondary,
          paddingHorizontal: inset.sm,
        }}
      >
        OR
      </Text>
      <View style={[styles.orDividerLine, { backgroundColor: colors.border.default }]} />
    </View>
  );
}

type AuthSubmitButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: AuthIcon;
  variant?: 'primary' | 'outline' | 'danger';
};

export function AuthSubmitButton({
  label,
  onPress,
  loading,
  disabled,
  icon: Icon = ArrowRight,
  variant = 'primary',
}: AuthSubmitButtonProps) {
  const { colors, typography, inset, gap, layout, radius, animations } = useTheme();
  const scale = useSharedValue<number>(animations.scale.resting);
  const inactive = disabled || loading;
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const foreground =
    isPrimary || isDanger
      ? inactive
        ? colors.text.tertiary
        : colors.accent.onAccent
      : inactive
        ? colors.text.tertiary
        : colors.text.primary;

  const backgroundColor = isDanger
    ? inactive
      ? colors.fill.secondary
      : colors.status.error
    : isPrimary
      ? inactive
        ? colors.fill.secondary
        : colors.accent.default
      : 'transparent';

  const borderColor = inactive
    ? colors.fill.secondary
    : isDanger
      ? colors.status.error
      : isPrimary
        ? colors.accent.default
        : colors.border.default;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => {
        if (!inactive) scale.value = withSpring(animations.scale.pressed, animations.spring.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(animations.scale.resting, animations.spring.snappy);
      }}
      style={[
        styles.submit,
        {
          minHeight: layout.authButtonHeight,
          paddingHorizontal: inset.lg,
          borderRadius: radius.button,
          borderWidth: isPrimary || isDanger ? 0 : 1.5,
          backgroundColor,
          borderColor,
          gap: gap.sm,
        },
        buttonStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <>
          <Text
            style={{
              ...typography.textPresets.button,
              fontSize: 16,
              fontWeight: '800',
              color: foreground,
            }}
          >
            {label}
          </Text>
          {isPrimary || isDanger ? <Icon size={18} color={foreground} strokeWidth={2.5} /> : null}
        </>
      )}
    </AnimatedPressable>
  );
}

type AuthMessageProps = {
  message: string | null;
  tone: 'error' | 'success';
};

export function AuthMessage({ message, tone }: AuthMessageProps) {
  const { colors, typography, inset, gap, layout, radius, animations, spacing } = useTheme();
  const translateX = useSharedValue<number>(animations.interactionState.idle);
  const idleState = animations.interactionState.idle;

  useEffect(() => {
    if (!message || tone !== 'error') return;
    translateX.value = withSequence(
      withTiming(-spacing[1], animations.timing.press),
      withTiming(spacing[1], animations.timing.press),
      withTiming(idleState, animations.timing.press),
    );
  }, [animations.timing.press, idleState, message, spacing, tone, translateX]);

  const messageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!message) return null;

  const isError = tone === 'error';
  const color = isError ? colors.status.error : colors.status.success;
  const backgroundColor = isError ? colors.status.errorSubtle : colors.status.successSubtle;
  const StatusIcon = isError ? AlertCircle : CheckCircle2;

  return (
    <Animated.View
      style={[
        styles.message,
        {
          padding: inset.md,
          borderRadius: radius.card,
          borderWidth: layout.borderWidth,
          borderColor: color,
          backgroundColor,
          gap: gap.sm,
        },
        messageStyle,
      ]}
    >
      <StatusIcon size={typography.fontSize.lg} color={color} strokeWidth={AUTH_ICON_STROKE} />
      <Text style={[styles.messageText, typography.textPresets.footnote, { color }]}>
        {message}
      </Text>
    </Animated.View>
  );
}

type AuthLinkProps = {
  href: Href;
  label: string;
  navigate?: Exclude<AuthNavigateMode, 'back'>;
};

export function AuthLink({ href, label, navigate = 'push' }: AuthLinkProps) {
  const { colors, typography, inset } = useTheme();

  return (
    <MotiPressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => navigateAuth(href, navigate)}
      style={{ paddingVertical: inset.xs }}
    >
      <Text
        style={[
          typography.textPresets.bodyStrong,
          { color: colors.accent.default, textDecorationLine: 'none', fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
    </MotiPressable>
  );
}

type AuthFooterPromptProps = {
  prompt: string;
  href: Href;
  actionLabel: string;
  navigate?: Exclude<AuthNavigateMode, 'back'>;
};

export function AuthFooterPrompt({
  prompt,
  href,
  actionLabel,
  navigate = 'replace',
}: AuthFooterPromptProps) {
  const { colors, typography, gap } = useTheme();

  return (
    <View style={[styles.footerPrompt, { gap: gap.xs }]}>
      <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>{prompt}</Text>
      <AuthLink href={href} label={actionLabel} navigate={navigate} />
    </View>
  );
}

type AuthBackLinkProps = {
  href: Href;
  label: string;
  navigate?: AuthNavigateMode;
};

export function AuthBackLink({ href, label, navigate = 'back' }: AuthBackLinkProps) {
  const { colors, typography, gap, inset } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigateAuth(href, navigate)}
      hitSlop={inset.xs}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: gap.xs,
        paddingVertical: inset.xs,
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
    justifyContent: 'center',
    width: '100%',
  },
  panelWrap: {
    width: '100%',
    alignSelf: 'center',
  },
  backButtonRoot: {
    position: 'absolute',
    zIndex: 1000,
  },
  logoWrap: {
    alignItems: 'center',
    width: '100%',
  },
  copyBlock: {
    width: '100%',
  },
  formStack: {
    width: '100%',
  },
  footerStack: {
    alignItems: 'center',
    width: '100%',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  input: {
    flex: 1,
    minWidth: 0,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageText: {
    flex: 1,
  },
  passwordRuleMeter: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  passwordRuleSegment: {
    flex: 1,
    height: PASSWORD_RULE_SEGMENT_HEIGHT,
    borderRadius: PASSWORD_RULE_SEGMENT_HEIGHT / 2,
  },
  footerPrompt: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  googleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  orDividerLine: {
    flex: 1,
    height: 1,
  },
});
