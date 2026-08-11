import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { CoachAnnouncementAudienceMode } from '@/services/database/announcements.repository';

type AudienceOption = {
  mode: CoachAnnouncementAudienceMode;
  eyebrow: string;
  title: string;
  subtitle: string;
};

const OPTIONS: AudienceOption[] = [
  {
    mode: 'general',
    eyebrow: 'All members',
    title: 'General',
    subtitle: 'Everyone on your class swipe lists',
  },
  {
    mode: 'classes',
    eyebrow: 'Targeted',
    title: 'Specific classes',
    subtitle: 'Only members on selected class lists',
  },
];

type Props = {
  value: CoachAnnouncementAudienceMode;
  onChange: (mode: CoachAnnouncementAudienceMode) => void;
};

export const AnnouncementAudiencePicker = memo(function AnnouncementAudiencePicker({
  value,
  onChange,
}: Props) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();

  const handleSelect = useCallback(
    (mode: CoachAnnouncementAudienceMode) => {
      triggerSelectionHaptic();
      onChange(mode);
    },
    [onChange],
  );

  return (
    <View style={{ gap: gap.sm }}>
      {OPTIONS.map((option) => {
        const selected = option.mode === value;
        return (
          <Pressable
            key={option.mode}
            onPress={() => handleSelect(option.mode)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.title}. ${option.subtitle}`}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: colors.surface.primary,
                borderColor: selected ? colors.accent.default : colors.border.subtle,
                borderWidth: selected ? 2 : layout.borderWidth,
                borderRadius: radius.card,
                padding: inset.md,
                opacity: pressed ? 0.88 : 1,
                gap: gap.xs,
              },
            ]}
          >
            <View style={[styles.optionHeader, { gap: gap.sm }]}>
              <Text
                style={[
                  typography.textPresets.metricLabel,
                  { color: selected ? colors.accent.default : colors.text.tertiary },
                ]}
              >
                {option.eyebrow}
              </Text>
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={selected ? colors.accent.default : colors.text.tertiary}
              />
            </View>
            <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
              {option.title}
            </Text>
            <Text style={[typography.textPresets.caption, { color: colors.text.secondary }]}>
              {option.subtitle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  option: {},
  optionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
