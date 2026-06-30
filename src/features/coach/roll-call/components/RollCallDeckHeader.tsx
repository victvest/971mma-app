import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatRunClassSchedule } from '@/features/coach/utils/classDisplay';
import { AppBar, AppBarIconButton } from '@/shared/components/ui';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type Props = {
  classId: string;
  classTitle: string;
  startsAt: string;
  onBackPress: () => void;
  onWalkInPress?: () => void;
  onRosterPress?: () => void;
};

export const RollCallDeckHeader = memo(function RollCallDeckHeader({
  classId,
  classTitle,
  startsAt,
  onBackPress,
  onWalkInPress,
  onRosterPress,
}: Props) {
  const router = useRouter();
  const { colors, inset, typography } = useTheme();
  const scheduleLabel = useMemo(() => formatRunClassSchedule(startsAt), [startsAt]);

  const scanAction = (
    <View style={styles.actions}>
      {onRosterPress ? (
        <AppBarIconButton
          icon="list-outline"
          accessibilityLabel="View roster"
          onPress={() => {
            triggerLightImpact();
            onRosterPress();
          }}
        />
      ) : null}
      {onWalkInPress ? (
        <AppBarIconButton
          icon="person-add-outline"
          accessibilityLabel="Add walk-in"
          onPress={() => {
            triggerLightImpact();
            onWalkInPress();
          }}
        />
      ) : null}
      <AppBarIconButton
        icon="qr-code-outline"
        accessibilityLabel="Scan member QR"
        onPress={() => {
          triggerLightImpact();
          router.push(`/(coach)/scanner?classId=${classId}`);
        }}
      />
    </View>
  );

  return (
    <View style={styles.wrap}>
      <AppBar
        title={classTitle}
        showBackButton
        onBackPress={onBackPress}
        rightElement={scanAction}
      />
      <Text
        style={[
          typography.textPresets.footnote,
          styles.subtitle,
          { color: colors.text.secondary, paddingBottom: inset.sm },
        ]}
        numberOfLines={1}
      >
        {scheduleLabel}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  subtitle: {
    textAlign: 'center',
  },
});
