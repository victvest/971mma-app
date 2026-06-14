import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, palette, spacing } from '../theme';
import { Logo } from './Logo';

type Props = {
  title?: string;
  subtitle?: string;
  showBell?: boolean;
  onBell?: () => void;
};

export function AppHeader({ title = '971 MMA', subtitle, showBell = true, onBell }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.logoBadge}>
            <Logo size={24} tint="black" />
          </View>
          <View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>

        {showBell ? (
          <Pressable
            onPress={onBell}
            style={styles.bell}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={19} color={colors.text} />
            <View style={styles.dot} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.glass16,
    borderWidth: 1,
    borderColor: palette.greenLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.displayBold, color: colors.text, fontSize: 20, letterSpacing: 0.4 },
  subtitle: { fontFamily: fonts.medium, color: colors.textMuted, fontSize: 12, marginTop: 1 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.glass16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
