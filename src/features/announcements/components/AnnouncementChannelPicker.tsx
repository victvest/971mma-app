import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import {
  ANNOUNCEMENT_CHANNELS,
  type AnnouncementChannelId,
} from '@/features/announcements/constants';

type Props = {
  value: AnnouncementChannelId;
  onChange: (value: AnnouncementChannelId) => void;
};

export const AnnouncementChannelPicker = memo(function AnnouncementChannelPicker({
  value,
  onChange,
}: Props) {
  const { colors, typography, gap, radius, layout } = useTheme();

  const handleSelect = useCallback(
    (channelId: AnnouncementChannelId) => {
      triggerSelectionHaptic();
      onChange(channelId);
    },
    [onChange],
  );

  return (
    <View style={[styles.wrap, { gap: gap.sm }]}>
      <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
        Channel
      </Text>
      <View style={[styles.row, { gap: gap.sm }]}>
        {ANNOUNCEMENT_CHANNELS.map((channel) => {
          const selected = channel.id === value;
          return (
            <Pressable
              key={channel.id}
              onPress={() => handleSelect(channel.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={channel.label}
              style={[
                styles.chip,
                {
                  borderRadius: radius.pill,
                  borderWidth: layout.borderWidth,
                  backgroundColor: selected ? colors.accent.default : colors.background.secondary,
                  borderColor: selected ? colors.accent.default : colors.border.default,
                },
              ]}
            >
              <Text
                style={[
                  typography.textPresets.captionMedium,
                  { color: selected ? colors.accent.onAccent : colors.text.primary },
                ]}
              >
                {channel.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
