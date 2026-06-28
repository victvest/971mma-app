import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { Ionicons } from '@expo/vector-icons';
import { triggerLightImpact } from '@/shared/haptics';
import { GlassNavChrome } from './navigation/GlassNavChrome';
import { GlassProfileControl } from './navigation/GlassProfileControl';
import { NAV_CHROME, UAE } from './navigation/uaeChrome';

export type HomeHeaderProps = {
  unreadCount: number;
  onOpenNotifications: () => void;
  avatarLabel: string;
  avatarUrl?: string | null;
  onOpenProfile: () => void;
  onOpenDrawer?: () => void;
  floating?: boolean;
  showBackButton?: boolean;
  onBackPress?: () => void;
};

/**
 * iOS 26–inspired floating navigation chrome.
 * Detached liquid-glass clusters (menu | actions) — not a single monolithic bar.
 */
export function HomeHeader({
  unreadCount,
  onOpenNotifications,
  avatarLabel,
  avatarUrl,
  onOpenProfile,
  onOpenDrawer,
  floating = true,
  showBackButton = false,
  onBackPress,
}: HomeHeaderProps) {
  const topInset = useAppTopInset();

  const handleLeftPress = () => {
    triggerLightImpact();
    if (showBackButton) {
      onBackPress?.();
      return;
    }
    onOpenDrawer?.();
  };

  const top = topInset + NAV_CHROME.topInset;
  const positioning = floating
    ? {
        position: 'absolute' as const,
        top,
        left: NAV_CHROME.horizontalInset,
        right: NAV_CHROME.horizontalInset,
        zIndex: 1000,
      }
    : {
        marginHorizontal: NAV_CHROME.horizontalInset,
        marginTop: top,
        marginBottom: 12,
      };

  return (
    <View style={[styles.root, positioning]} pointerEvents="box-none">
      <GlassNavChrome
        onPress={handleLeftPress}
        accessibilityLabel={showBackButton ? 'Go back' : 'Open navigation menu'}
        style={styles.soloCluster}
        contentStyle={styles.soloContent}
      >
        <Ionicons
          name={showBackButton ? 'chevron-back' : 'menu-outline'}
          size={NAV_CHROME.iconSize}
          color={UAE.ink}
        />
      </GlassNavChrome>

      <GlassNavChrome
        accessibilityLabel="Account and notifications"
        layout="bar"
        style={styles.actionCapsule}
        contentStyle={styles.actionCapsuleContent}
        borderRadius={NAV_CHROME.glassRadius}
      >
        <Pressable
          onPress={() => {
            triggerLightImpact();
            onOpenNotifications();
          }}
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0
              ? `Open notifications, ${unreadCount} unread`
              : 'Open notifications'
          }
          hitSlop={4}
          style={({ pressed }) => [styles.actionCell, pressed && styles.pressed]}
        >
          <Ionicons name="notifications-outline" size={NAV_CHROME.iconSize} color={UAE.ink} />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
            </View>
          ) : null}
        </Pressable>

        <View style={styles.actionDivider} />

        <GlassProfileControl
          label={avatarLabel}
          avatarUrl={avatarUrl}
          onOpenProfile={onOpenProfile}
        />
      </GlassNavChrome>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  soloCluster: {
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  soloContent: {
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  actionCapsule: {
    minHeight: NAV_CHROME.clusterHeight,
  },
  actionCapsuleContent: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: NAV_CHROME.clusterHeight,
    paddingHorizontal: 6,
  },
  actionCell: {
    alignItems: 'center',
    height: NAV_CHROME.clusterHeight,
    justifyContent: 'center',
    width: NAV_CHROME.clusterHeight,
  },
  pressed: {
    opacity: 0.7,
  },
  actionDivider: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    height: 30,
    marginHorizontal: 2,
    width: StyleSheet.hairlineWidth,
  },
  badge: {
    position: 'absolute',
    right: 13,
    top: 12,
  },
  badgeDot: {
    backgroundColor: UAE.red,
    borderColor: UAE.white,
    borderRadius: NAV_CHROME.badgeSize / 2,
    borderWidth: 1.5,
    height: NAV_CHROME.badgeSize,
    width: NAV_CHROME.badgeSize,
  },
});
