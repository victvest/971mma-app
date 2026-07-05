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
};

export const RollCallDeckHeader = memo(function RollCallDeckHeader({
  classId,
  classTitle,
  startsAt,
  onBackPress,
}: Props) {
  const router = useRouter();
  const { colors, inset, typography } = useTheme();
  const scheduleLabel = useMemo(() => formatRunClassSchedule(startsAt), [startsAt]);

  const scanAction = (
    <AppBarIconButton
      icon="qr-code-outline"
      accessibilityLabel="Scan member QR"
      onPress={() => {
        triggerLightImpact();
        router.push(`/(coach)/scanner?classId=${classId}`);
      }}
    />
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
  subtitle: {
    textAlign: 'center',
  },
});
