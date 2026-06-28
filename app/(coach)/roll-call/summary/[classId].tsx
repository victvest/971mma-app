import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { RollCallSummaryScreen } from '@/features/coach/roll-call/components/RollCallSummaryScreen';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';

export default function RollCallSummaryRoute() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { colors, inset } = useTheme();

  if (classId) {
    return <RollCallSummaryScreen classId={classId} />;
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary, padding: inset.lg }]}>
      <StateBlock kind="error" title="Missing class" message="Open summary from roll call first." />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
});
