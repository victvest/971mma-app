import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiquidGlassSurface } from '@/shared/components/ui/LiquidGlassSurface';
import { useTheme } from '@/shared/theme';
import { AppBarBackButton, appBarButtonStyles } from './AppBarBackButton';
import { APP_BAR_SIDE_SLOT_WIDTH, getAppBarTitleStyle } from './appBarShared';

interface AppBarProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightElement?: React.ReactNode;
  floating?: boolean;
  /** Extra space below the bar content (adds height from the bottom edge). */
  bottomInset?: number;
}

export function AppBar({
  title,
  showBackButton = true,
  onBackPress,
  rightElement,
  floating = false,
  bottomInset = 0,
}: AppBarProps) {
  const theme = useTheme();
  const { inset } = theme;
  const router = useRouter();
  const safeInsets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const barHeight = theme.layout.headerHeight;
  const resolvedHeight = floating ? barHeight + safeInsets.top + bottomInset : barHeight + bottomInset;
  const resolvedPaddingTop = floating ? safeInsets.top : 0;
  const resolvedPaddingBottom = bottomInset;

  const content = (
    <>
      <View style={[appBarButtonStyles.sideSlot, appBarButtonStyles.sideSlotStart]}>
        {showBackButton ? <AppBarBackButton onPress={handleBack} /> : null}
      </View>

      <Text numberOfLines={1} style={[styles.title, getAppBarTitleStyle(theme)]}>
        {title}
      </Text>

      <View style={[appBarButtonStyles.sideSlot, appBarButtonStyles.sideSlotEnd]}>
        {rightElement ?? <View style={styles.rightPlaceholder} />}
      </View>
    </>
  );

  return (
    <LiquidGlassSurface
      variant="chrome"
      borderRadius={0}
      showBorder={false}
      style={[
        styles.shell,
        styles.shadow,
        floating && styles.floating,
        {
          height: resolvedHeight,
        },
      ]}
      contentStyle={[
        styles.row,
        {
          paddingTop: resolvedPaddingTop,
          paddingBottom: resolvedPaddingBottom,
          paddingHorizontal: inset.md,
        },
      ]}
    >
      {content}
    </LiquidGlassSurface>
  );
}

const styles = StyleSheet.create({
  shell: {
    justifyContent: 'center',
    width: '100%',
  },
  floating: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  row: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    flexShrink: 1,
  },
  rightPlaceholder: {
    width: APP_BAR_SIDE_SLOT_WIDTH,
  },
  shadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});
