import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiPressable } from '@/shared/animations';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import { useTheme } from '@/shared/theme';

type HeaderButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

function HeaderButton({ icon, label, onPress }: HeaderButtonProps) {
  const { colors, radius, layout } = useTheme();
  return (
    <MotiPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.headerButton,
        {
          borderRadius: radius.pill,
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderWidth: layout.borderWidth,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.text.primary} />
    </MotiPressable>
  );
}

type Props = {
  onSearch?: () => void;
  onNewPost: () => void;
  variant?: 'academy' | 'child';
};

export function FeedSectionHeader({ onSearch, onNewPost, variant = 'academy' }: Props) {
  const { gap } = useTheme();
  const childVariant = variant === 'child';

  return (
    <View style={[styles.container, { gap: gap.sm }]}>
      <View style={[styles.titleRow, { gap: gap.md }]}>
        <View style={[styles.titleBlock, { gap: gap.xs }]}>
          <AcademyEyebrow
            label={childVariant ? 'Child posts' : 'Academy feed'}
            accent
            showFlag={false}
          />
          <TabHeroTitle
            lines={
              childVariant
                ? [[{ text: 'Their posts,' }], [{ text: 'in one place.', accent: true }]]
                : [[{ text: 'Your mats,' }], [{ text: 'your people.', accent: true }]]
            }
          />
        </View>
        <View style={[styles.headerActions, { gap: gap.sm }]}>
          {onSearch ? <HeaderButton icon="search" label="Search feed" onPress={onSearch} /> : null}
          <HeaderButton icon="add" label="New post" onPress={onNewPost} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  titleRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerActions: {
    flexDirection: 'row',
    flexShrink: 0,
  },
  headerButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
});
