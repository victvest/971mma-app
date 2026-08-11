import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import { useTheme } from '@/shared/theme';

type Props = {
  mode?: 'member-card' | 'child-status';
};

export function CheckInSectionHeader({ mode = 'member-card' }: Props) {
  const { gap } = useTheme();
  const childStatus = mode === 'child-status';

  return (
    <View style={[styles.container, { gap: gap.sm }]}>
      <AcademyEyebrow
        label={childStatus ? 'Check-in status' : 'Member Card'}
        accent
        showFlag={false}
      />
      <TabHeroTitle
        collapseOnWide
        lines={
          childStatus
            ? [[{ text: 'Today' }], [{ text: 'at the gym.', accent: true }]]
            : [[{ text: 'Your card.' }], [{ text: 'Your identity.', accent: true }]]
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 8,
  },
});
