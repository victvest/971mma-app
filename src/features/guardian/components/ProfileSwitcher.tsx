import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScrollView } from '@/shared/components/ui';
import { useActiveProfileOptions } from '@/features/guardian/hooks/useGuardian';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { useActiveProfileStore } from '@/stores/useActiveProfileStore';
import { useTheme } from '@/shared/theme';
import type { ActiveProfileOption } from '@/types/domain';

type ProfileSwitcherProps = {
  compact?: boolean;
};

function ProfileChip({
  option,
  selected,
  onPress,
}: {
  option: ActiveProfileOption;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.accent.default : colors.background.secondary,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? colors.accent.onAccent : colors.text.primary,
          fontWeight: selected ? '700' : '500',
        }}
      >
        {option.isSelf ? 'Me' : option.label}
      </Text>
      {!option.isSelf && option.beltRank ? (
        <Text
          style={{
            color: selected ? colors.accent.onAccent : colors.text.tertiary,
            fontSize: 11,
            marginTop: 2,
          }}
        >
          {option.beltRank}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function ProfileSwitcher({ compact = false }: ProfileSwitcherProps) {
  const { colors, typography } = useTheme();
  const activeMemberId = useActiveMemberId();
  const setActiveUserId = useActiveProfileStore((s) => s.setActiveUserId);
  const { options, hasChildren } = useActiveProfileOptions();

  const handleSelect = useCallback(
    (option: ActiveProfileOption) => {
      setActiveUserId(option.isSelf ? null : option.userId);
    },
    [setActiveUserId],
  );

  if (!hasChildren || options.length <= 1) return null;

  return (
    <View style={styles.container}>
      {!compact ? (
        <Text style={[typography.textPresets.caption, { color: colors.text.secondary, marginBottom: 8 }]}>
          Active profile
        </Text>
      ) : null}
      <AppScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map((option) => (
          <ProfileChip
            key={option.userId}
            option={option}
            selected={option.userId === activeMemberId}
            onPress={() => handleSelect(option)}
          />
        ))}
      </AppScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  row: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: 'center',
  },
});
