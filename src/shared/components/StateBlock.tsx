import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/shared/components/ui';
import { useOfflineRetry } from '@/shared/hooks/useOfflineRetry';
import { useTheme } from '@/shared/theme';

type Props = {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** When true, retry shows a toast instead of firing while offline. */
  offlineAwareRetry?: boolean;
};

export function StateBlock({
  kind,
  title,
  message,
  actionLabel,
  onAction,
  offlineAwareRetry = false,
}: Props) {
  const { colors, typography } = useTheme();
  const guardedAction = useOfflineRetry(onAction ?? (() => undefined));
  const handleAction = offlineAwareRetry && onAction ? guardedAction : onAction;

  return (
    <View style={styles.wrap}>
      {kind === 'loading' ? <ActivityIndicator size="large" color={colors.accent.default} /> : null}
      <Text style={[typography.textPresets.subtitle, styles.title, { color: colors.text.primary }]}>
        {title}
      </Text>
      {message ? (
        <Text style={[styles.message, { color: colors.text.secondary }]}>{message}</Text>
      ) : null}
      {actionLabel && handleAction ? (
        <Button label={actionLabel} onPress={handleAction} variant="outline" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 12,
  },
  title: { textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  action: { marginTop: 8, alignSelf: 'stretch' },
});
