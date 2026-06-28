import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMyGuardiansAsTrainee } from '@/features/guardian/hooks/useGuardian';
import { useTheme } from '@/shared/theme';

export function MyGuardiansCard() {
  const { colors, typography, radius, shadows, layout } = useTheme();
  const guardiansQuery = useMyGuardiansAsTrainee();
  const guardians = guardiansQuery.data ?? [];

  if (guardiansQuery.isLoading || guardians.length === 0) return null;

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderWidth: layout.borderWidth,
          borderRadius: radius.cardLarge,
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0)']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 36,
          borderTopLeftRadius: radius.cardLarge,
          borderTopRightRadius: radius.cardLarge,
        }}
        pointerEvents="none"
      />
      <Text style={[styles.title, { color: colors.text.primary }]}>Linked guardians</Text>
      <Text style={[styles.body, { color: colors.text.secondary }]}>
        These accounts can view your attendance, belt path, and rewards. They cannot change your
        points or check-ins unless staff allows guardian check-in on your profile.
      </Text>

      {guardians.map((guardian) => (
        <View key={guardian.linkId} style={[styles.row, { borderColor: colors.border.subtle }]}>
          <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
            {guardian.guardianName}
          </Text>
          <Text style={[styles.meta, { color: colors.text.tertiary }]}>
            {guardian.accountMode === 'managed' ? 'MANAGED PROFILE' : 'INDEPENDENT ACCOUNT'}
            {guardian.accountMode === 'independent' && guardian.allowGuardianQr
              ? ' · guardian check-in enabled'
              : guardian.accountMode === 'independent'
                ? ' · you check in on your phone'
                : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginTop: 16, gap: 10, position: 'relative' },
  title: { fontSize: 16, fontWeight: '700', zIndex: 1 },
  body: { fontSize: 14, lineHeight: 20, zIndex: 1 },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    zIndex: 1,
  },
  meta: { fontSize: 12, marginTop: 4, textTransform: 'uppercase' },
});
