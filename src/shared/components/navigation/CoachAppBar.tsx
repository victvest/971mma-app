import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiPressable } from '@/shared/animations';
import { useTheme } from '@/shared/theme';

type Props = {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightElement?: React.ReactNode;
};

export function CoachAppBar({
  title,
  subtitle,
  showBackButton = true,
  onBackPress,
  rightElement,
}: Props) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const router = useRouter();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    router.back();
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: inset['2xs'],
          paddingHorizontal: inset.lg,
          paddingBottom: inset.md,
          borderBottomWidth: layout.borderWidth,
          borderBottomColor: colors.border.subtle,
        },
      ]}
    >
      <View style={[styles.toolbar, { marginBottom: gap.sm }]}>
        {showBackButton ? (
          <MotiPressable
            onPress={handleBack}
            accessibilityLabel="Go back"
            style={[
              styles.backButton,
              {
                width: layout.appHeaderIconTouch,
                height: layout.appHeaderIconTouch,
                borderRadius: radius.pill,
                backgroundColor: colors.fill.secondary,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
          </MotiPressable>
        ) : (
          <View style={{ width: layout.appHeaderIconTouch }} />
        )}
        <View style={styles.rightSlot}>{rightElement}</View>
      </View>

      <Text style={[typography.textPresets.title, { color: colors.text.primary }]}>{title}</Text>
      {subtitle ? (
        <Text
          style={[
            typography.textPresets.footnote,
            { color: colors.text.secondary, marginTop: gap.xs },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSlot: {
    alignItems: 'flex-end',
    minWidth: 44,
  },
});
