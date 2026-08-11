import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LiquidGlassSurface } from '@/shared/components/ui/LiquidGlassSurface';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { getDefaultHomeRoute } from '@/shared/navigation/defaultHomeRoute';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { AppBarBackButton, appBarButtonStyles } from './AppBarBackButton';
import { APP_BAR_SIDE_SLOT_WIDTH, getAppBarTitleStyle } from './appBarShared';

interface AppBarProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  fallbackHref?: Href;
  rightElement?: React.ReactNode;
  floating?: boolean;
  /** Extra space below the bar content (adds height from the bottom edge). */
  bottomInset?: number;
  /** Allow long titles to wrap without colliding with side actions. Default 1. */
  titleNumberOfLines?: number;
}

export function AppBar({
  title,
  showBackButton = true,
  onBackPress,
  fallbackHref,
  rightElement,
  floating = false,
  bottomInset,
  titleNumberOfLines = 1,
}: AppBarProps) {
  const theme = useTheme();
  const { inset, appBarShadow } = theme;
  const resolvedBottomInset = bottomInset ?? theme.layout.appBarBottomInset;
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const topInset = useAppTopInset();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackHref ?? getDefaultHomeRoute(role));
    }
  };

  const barHeight = theme.layout.headerHeight;
  const resolvedHeight = floating
    ? barHeight + topInset + resolvedBottomInset
    : barHeight + resolvedBottomInset;
  const resolvedPaddingTop = floating ? topInset : 0;
  const resolvedPaddingBottom = resolvedBottomInset;

  const allowsMultilineTitle = titleNumberOfLines > 1;

  const content = (
    <>
      <View style={[appBarButtonStyles.sideSlot, appBarButtonStyles.sideSlotStart]}>
        {showBackButton ? <AppBarBackButton onPress={handleBack} /> : null}
      </View>

      <Text
        numberOfLines={titleNumberOfLines}
        style={[
          styles.title,
          getAppBarTitleStyle(theme),
          allowsMultilineTitle && styles.titleMultiline,
        ]}
      >
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
        appBarShadow(),
        floating && styles.floating,
        allowsMultilineTitle ? { minHeight: resolvedHeight } : { height: resolvedHeight },
      ]}
      contentStyle={[
        styles.row,
        {
          paddingTop: resolvedPaddingTop,
          paddingBottom: resolvedPaddingBottom,
          paddingHorizontal: inset.md,
        },
        allowsMultilineTitle && styles.rowMultiline,
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
    minWidth: 0,
  },
  titleMultiline: {
    lineHeight: 22,
  },
  rowMultiline: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  rightPlaceholder: {
    width: APP_BAR_SIDE_SLOT_WIDTH,
  },
});
