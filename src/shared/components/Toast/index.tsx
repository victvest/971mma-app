import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ToastLib, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message';
import { useTheme } from '@/shared/theme';
import type { AppColors } from '@/shared/theme/colors';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

type VariantConfig = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  getColor: (c: AppColors) => string;
  getSubtle: (c: AppColors) => string;
};

const VARIANT: Record<ToastVariant, VariantConfig> = {
  success: {
    icon: 'checkmark-circle',
    getColor: (c) => c.status.success,
    getSubtle: (c) => c.status.successSubtle,
  },
  error: {
    icon: 'close-circle',
    getColor: (c) => c.status.error,
    getSubtle: (c) => c.status.errorSubtle,
  },
  warning: {
    icon: 'warning',
    getColor: (c) => c.status.warning,
    getSubtle: (c) => c.status.warningSubtle,
  },
  info: {
    icon: 'information-circle',
    getColor: (c) => c.accent.default,
    getSubtle: (c) => c.accent.subtle,
  },
};

type ExtraProps = { duration?: number; placement?: 'top' | 'bottom' };
type Props = ToastConfigParams<ExtraProps>;

function AppToast({ text1, text2, type, hide, onPress }: Props) {
  const { colors, typography, radius, shadows } = useTheme();
  const { width } = useWindowDimensions();

  const variant = ((type as ToastVariant) in VARIANT ? type : 'info') as ToastVariant;
  const cfg = VARIANT[variant];
  const accentColor = cfg.getColor(colors);
  const subtleColor = cfg.getSubtle(colors);

  const TOAST_W = Math.min(width - 32, 440);

  return (
    <View
      style={[
        styles.card,
        shadows.lg,
        {
          width: TOAST_W,
          borderRadius: radius.card,
          backgroundColor: colors.background.elevated,
          borderColor: colors.border.subtle,
        },
      ]}
    >
      <Pressable style={styles.row} onPress={() => onPress?.()}>
        <View
          style={[
            styles.iconPill,
            { backgroundColor: subtleColor, borderRadius: radius.pill },
          ]}
        >
          <Ionicons name={cfg.icon} size={20} color={accentColor} />
        </View>

        <View style={styles.textBlock}>
          {text1 ? (
            <Text
              style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}
              numberOfLines={1}
            >
              {text1}
            </Text>
          ) : null}
          {text2 ? (
            <Text
              style={[
                typography.textPresets.footnote,
                { color: colors.text.secondary, marginTop: 2 },
              ]}
              numberOfLines={2}
            >
              {text2}
            </Text>
          ) : null}
        </View>

        <Pressable onPress={() => hide()} style={styles.dismissBtn} hitSlop={10}>
          <Ionicons name="close" size={15} color={colors.text.tertiary} />
        </Pressable>
      </Pressable>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: (props) => <AppToast {...(props as unknown as Props)} />,
  error: (props) => <AppToast {...(props as unknown as Props)} />,
  warning: (props) => <AppToast {...(props as unknown as Props)} />,
  info: (props) => <AppToast {...(props as unknown as Props)} />,
};

export const toast = {
  success: (title: string, description?: string, duration = 4_000) =>
    ToastLib.show({
      type: 'success',
      text1: title,
      text2: description,
      visibilityTime: duration,
      props: { duration } satisfies ExtraProps,
    }),

  error: (title: string, description?: string, duration = 5_000) =>
    ToastLib.show({
      type: 'error',
      text1: title,
      text2: description,
      visibilityTime: duration,
      props: { duration } satisfies ExtraProps,
    }),

  warning: (title: string, description?: string, duration = 4_000) =>
    ToastLib.show({
      type: 'warning',
      text1: title,
      text2: description,
      visibilityTime: duration,
      props: { duration } satisfies ExtraProps,
    }),

  info: (title: string, description?: string, duration = 3_500) =>
    ToastLib.show({
      type: 'info',
      text1: title,
      text2: description,
      visibilityTime: duration,
      props: { duration } satisfies ExtraProps,
    }),

  hide: () => ToastLib.hide(),
} as const;

const AUTH_TOAST_BOTTOM_OFFSET = 24;

function showAuthToast(
  type: ToastVariant,
  title: string,
  description: string | undefined,
  duration: number,
) {
  ToastLib.show({
    type,
    text1: title,
    text2: description,
    position: 'bottom',
    bottomOffset: AUTH_TOAST_BOTTOM_OFFSET,
    visibilityTime: duration,
    props: { duration, placement: 'bottom' } satisfies ExtraProps,
  });
}

export const authToast = {
  success: (title: string, description?: string, duration = 4_000) =>
    showAuthToast('success', title, description, duration),

  error: (title: string, description?: string, duration = 5_000) =>
    showAuthToast('error', title, description, duration),

  warning: (title: string, description?: string, duration = 4_000) =>
    showAuthToast('warning', title, description, duration),

  info: (title: string, description?: string, duration = 3_500) =>
    showAuthToast('info', title, description, duration),

  hide: () => ToastLib.hide(),
} as const;

const styles = StyleSheet.create({
  card: {
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 12,
    paddingVertical: 14,
    gap: 12,
  },
  iconPill: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
  },
  dismissBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    opacity: 0.65,
  },
});
