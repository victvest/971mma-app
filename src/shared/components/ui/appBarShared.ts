import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import type { Theme } from '@/shared/theme';

export const APP_BAR_TITLE_FONT_SIZE = 17;
export const APP_BAR_BACK_ICON_SIZE = 22;
/** Circular app bar icon cluster — keep in sync with `NAV_CHROME.clusterHeight`. */
export const APP_BAR_ICON_CLUSTER_SIZE = 58;
/** Matches icon cluster width so title stays centered against back/actions. */
export const APP_BAR_SIDE_SLOT_WIDTH = APP_BAR_ICON_CLUSTER_SIZE;

export function getAppBarTitleStyle(theme: Theme): TextStyle {
  const { colors, resolveFontFamily, fontWeight } = theme;
  return {
    color: colors.text.primary,
    fontFamily: resolveFontFamily('display', fontWeight.bold),
    fontSize: APP_BAR_TITLE_FONT_SIZE,
    fontWeight: '400',
    textAlign: 'center',
  };
}

export function getAppBarShellStyle(theme: Theme): ViewStyle {
  const { colors, inset, layout } = theme;
  return {
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: layout.headerHeight,
    justifyContent: 'space-between',
    paddingHorizontal: inset.md,
  };
}

export function getAppBarBackButtonStyle(theme: Theme): ViewStyle {
  const { colors, layout, radius } = theme;
  return {
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: radius.pill,
    height: layout.appHeaderIconTouch,
    justifyContent: 'center',
    width: layout.appHeaderIconTouch,
  };
}
