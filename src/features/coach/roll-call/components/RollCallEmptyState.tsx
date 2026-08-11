import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/shared/components/ui';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type Props = {
  onScanPress: () => void;
};

export const RollCallEmptyState = memo(function RollCallEmptyState({ onScanPress }: Props) {
  const { colors, typography, inset, gap } = useTheme();

  const handleScanPress = () => {
    triggerLightImpact();
    onScanPress();
  };

  return (
    <View style={[styles.wrap, { paddingHorizontal: inset.xl, gap: gap.md }]}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: colors.accent.subtle,
            borderRadius: 999,
          },
        ]}
      >
        <Ionicons name="people-outline" size={32} color={colors.accent.default} />
      </View>

      <Text style={[typography.textPresets.subtitle, styles.title, { color: colors.text.primary }]}>
        No one on this list yet
      </Text>
      <Text style={[typography.textPresets.body, styles.message, { color: colors.text.secondary }]}>
        Scan each member QR once to add them
      </Text>

      <Button
        label="Scan member QR"
        icon="qr-code-outline"
        onPress={handleScanPress}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 32,
  },
  iconWrap: {
    alignItems: 'center',
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    lineHeight: 22,
    textAlign: 'center',
  },
});
