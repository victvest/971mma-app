import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';

type ScheduleEmptyStateProps = {
  loading?: boolean;
};

export function ScheduleEmptyState({ loading = false }: ScheduleEmptyStateProps) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.iconRing,
          {
            backgroundColor: `${colors.accent.default}12`,
            borderColor: `${colors.accent.default}20`,
          },
        ]}
      >
        <Ionicons
          name={loading ? 'sync-outline' : 'calendar-outline'}
          size={30}
          color={colors.accent.default}
        />
      </View>

      <Text style={[typography.textPresets.subtitle, styles.title, { color: colors.text.primary }]}>
        {loading ? 'Loading your schedule' : 'No classes today'}
      </Text>

      <Text style={[styles.message, { color: colors.text.secondary }]}>
        {loading
          ? 'Fetching the latest classes.'
          : 'Check back later or try another filter.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 300,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  iconRing: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    marginBottom: 6,
    width: 72,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 280,
    textAlign: 'center',
  },
});
