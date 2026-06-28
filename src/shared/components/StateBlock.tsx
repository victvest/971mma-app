import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';

type Props = {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StateBlock({ kind, title, message, actionLabel, onAction }: Props) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.wrap}>
      {kind === 'loading' ? <ActivityIndicator size="large" color={colors.accent.default} /> : null}
      <Text style={[typography.textPresets.subtitle, styles.title, { color: colors.text.primary }]}>
        {title}
      </Text>
      {message ? (
        <Text style={[styles.message, { color: colors.text.secondary }]}>{message}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="outline" style={styles.action} />
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
