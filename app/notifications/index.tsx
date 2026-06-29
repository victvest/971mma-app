import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { isGymToday } from '@/core/time/gymTime';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notifications/hooks/useNotifications';
import {
  computeNotificationChipMetrics,
  matchesNotificationFilter,
  type NotificationFilterId,
} from '@/features/notifications/utils/notificationCategory';
import {
  resolveNotificationAction,
} from '@/features/notifications/resolveNotificationAction';
import { NotificationsSectionHeader } from '@/features/notifications/components/NotificationsSectionHeader';
import { NotificationsSkeleton } from '@/shared/animations';
import { StateBlock } from '@/shared/components/StateBlock';
import { AppBar, AppBarIconButton } from '@/shared/components/ui';
import { NAV_CHROME } from '@/features/home/components/navigation/uaeChrome';
import { useTheme, type AppColors } from '@/shared/theme';
import type { NotificationItem } from '@/types/domain';
import {
  triggerLightImpact,
  triggerSelectionHaptic,
  triggerSuccessNotification,
} from '@/shared/haptics';

function getNotificationVisuals(type: string, title: string, colors: AppColors) {
  const t = type.toLowerCase();
  const titleLower = title.toLowerCase();

  if (
    t === 'announcement' ||
    t === 'community' ||
    t.includes('announcement') ||
    t.includes('community') ||
    titleLower.includes('announcement')
  ) {
    return {
      icon: 'megaphone-outline' as const,
      color: colors.accent.default,
    };
  }

  if (
    t === 'promotion' ||
    t === 'belt' ||
    t === 'milestone' ||
    t.includes('belt') ||
    titleLower.includes('belt') ||
    titleLower.includes('promotion') ||
    titleLower.includes('stripe')
  ) {
    return {
      icon: 'ribbon-outline' as const,
      color: colors.status.warning,
    };
  }

  if (
    t === 'parent_child' ||
    t.includes('guardian') ||
    titleLower.includes('trainee') ||
    titleLower.includes('checked in')
  ) {
    return {
      icon: 'people-outline' as const,
      color: colors.accent.default,
    };
  }

  if (t === 'class_attendance' || t === 'class' || t.includes('class') || titleLower.includes('class')) {
    return {
      icon: 'calendar-outline' as const,
      color: colors.status.success,
    };
  }

  if (
    titleLower.includes('streak') ||
    titleLower.includes('come-back') ||
    titleLower.includes('reminder') ||
    t.includes('reminder') ||
    titleLower.includes('protect')
  ) {
    return {
      icon: 'flame-outline' as const,
      color: colors.status.error,
    };
  }

  if (
    t.includes('reward') ||
    t.includes('point') ||
    t.includes('redemption') ||
    titleLower.includes('reward') ||
    titleLower.includes('points') ||
    titleLower.includes('redeem')
  ) {
    return {
      icon: 'gift-outline' as const,
      color: colors.accent.pressed,
    };
  }

  return {
    icon: 'notifications-outline' as const,
    color: colors.text.tertiary,
  };
}

function groupNotifications(items: NotificationItem[]) {
  const today: NotificationItem[] = [];
  const yesterday: NotificationItem[] = [];
  const thisWeek: NotificationItem[] = [];
  const older: NotificationItem[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const sevenDaysAgoStart = todayStart - 6 * 24 * 60 * 60 * 1000;

  items.forEach((item) => {
    const time = new Date(item.createdAt).getTime();
    if (time >= todayStart) {
      today.push(item);
    } else if (time >= yesterdayStart) {
      yesterday.push(item);
    } else if (time >= sevenDaysAgoStart) {
      thisWeek.push(item);
    } else {
      older.push(item);
    }
  });

  return { today, yesterday, thisWeek, older };
}

function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  if (isGymToday(iso, now)) {
    return new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isGymToday(iso, yesterday)) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

const FILTER_CHIPS: ReadonlyArray<{ id: NotificationFilterId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'milestone', label: 'Milestones' },
  { id: 'reminder', label: 'Reminders' },
  { id: 'reward', label: 'Rewards' },
];

interface NotificationRowProps {
  item: NotificationItem;
  onPress: () => void;
}

const NotificationRow = React.memo(function NotificationRow({ item, onPress }: NotificationRowProps) {
  const { colors, typography, radius, inset, layout, shadows } = useTheme();
  const unread = !item.readAt;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const visuals = useMemo(
    () => getNotificationVisuals(item.type, item.title, colors),
    [colors, item.type, item.title],
  );

  const timeLabel = useMemo(() => formatNotificationTime(item.createdAt), [item.createdAt]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={`${item.title}. ${timeLabel}`}
      style={styles.rowPressable}
    >
      <Animated.View
        style={[
          styles.rowContainer,
          shadows.card,
          {
            backgroundColor: colors.surface.primary,
            borderColor: colors.border.subtle,
            borderRadius: radius.card,
            borderWidth: layout.borderWidth,
            paddingHorizontal: inset.md,
            paddingVertical: inset.sm + 2,
          },
          animatedStyle,
        ]}
      >
        <View style={styles.rowLayout}>
          <Ionicons
            name={visuals.icon}
            size={20}
            color={visuals.color}
            style={styles.rowIcon}
          />

          <View style={styles.contentCol}>
            <View style={styles.rowTop}>
              <Text
                style={[
                  typography.textPresets.bodyStrong,
                  { color: colors.text.primary, flex: 1 },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text
                style={[
                  typography.textPresets.caption,
                  { color: colors.text.tertiary, marginLeft: inset.sm },
                ]}
              >
                {timeLabel}
              </Text>
            </View>

            {item.body ? (
              <Text
                style={[typography.textPresets.footnote, { color: colors.text.secondary }]}
                numberOfLines={1}
              >
                {item.body}
              </Text>
            ) : null}
          </View>

          {unread ? (
            <View style={[styles.unreadDot, { backgroundColor: colors.accent.default }]} />
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
});

export default function NotificationsScreen() {
  const { colors, inset, layout } = useTheme();
  const router = useRouter();
  const safeInsets = useSafeAreaInsets();
  const scrollTopInset = layout.headerHeight + safeInsets.top + inset.sm;

  const notificationsQuery = useNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();

  const [activeFilter, setActiveFilter] = useState<NotificationFilterId>('all');

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const rawData = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data]);

  const chipMetrics = useMemo(
    () => computeNotificationChipMetrics(rawData),
    [rawData],
  );

  const filteredData = useMemo(
    () => rawData.filter((item) => matchesNotificationFilter(item, activeFilter)),
    [rawData, activeFilter],
  );

  const unreadCount = chipMetrics.unreadCount;

  const grouped = useMemo(() => {
    return groupNotifications(filteredData);
  }, [filteredData]);

  const handleNotificationPress = useCallback(
    (item: NotificationItem) => {
      triggerLightImpact();
      const action = resolveNotificationAction(item);

      if (!item.readAt) {
        markReadMutation.mutate(item.id);
      }

      if (action) {
        action.beforeNavigate?.();
        router.push(action.href);
      }
    },
    [markReadMutation, router],
  );

  const handleMarkAllRead = useCallback(() => {
    if (rawData.length === 0 || unreadCount === 0) return;
    triggerSuccessNotification();
    markAllMutation.mutate();
  }, [rawData, unreadCount, markAllMutation]);

  // Non-needed UI components: slide up and fade out as user scrolls down
  const animatedHeroStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 80], [1, 0], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, [0, 80], [0, -20], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const renderSection = (title: string, items: NotificationItem[]) => {
    if (items.length === 0) return null;
    return (
      <View key={title} style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderText, { color: colors.text.tertiary }]}>
            {title}
          </Text>
          <View style={[styles.sectionLine, { backgroundColor: colors.border.subtle }]} />
        </View>
        <View style={styles.sectionList}>
          {items.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onPress={() => handleNotificationPress(item)}
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['left', 'right']}
    >
      {/* Floating liquid-glass nav chrome */}
      <AppBar
        title="Notifications"
        floating={true}
        onBackPress={() => {
          triggerLightImpact();
          router.back();
        }}
        rightElement={
          <AppBarIconButton
            icon="settings-outline"
            onPress={() => router.push('/notifications/preferences')}
            accessibilityLabel="Open notification preferences"
          />
        }
      />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: scrollTopInset,
            paddingBottom: safeInsets.bottom + 32,
            paddingHorizontal: inset.lg,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={notificationsQuery.isRefetching}
            onRefresh={() => notificationsQuery.refetch()}
            progressViewOffset={scrollTopInset}
            tintColor={colors.accent.default}
          />
        }
      >
        {/* Animated Hero Banner + Filter Chips (Hides on Scroll) */}
        <Animated.View style={animatedHeroStyle}>
          {/* Large display header */}
          <NotificationsSectionHeader />

          {rawData.length > 0 && unreadCount > 0 ? (
            <View style={styles.heroActions}>
              <Pressable
                onPress={handleMarkAllRead}
                accessibilityLabel="Mark all as read"
                style={({ pressed }) => [
                  styles.markAllButton,
                  {
                    backgroundColor: pressed ? colors.fill.secondary : colors.background.secondary,
                    borderColor: colors.border.subtle,
                  },
                ]}
              >
                <Ionicons name="checkmark-done" size={15} color={colors.text.secondary} />
                <Text style={[styles.markAllText, { color: colors.text.secondary }]}>
                  Mark all as read
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Horizontal category filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {FILTER_CHIPS.map((chip) => {
              const active = activeFilter === chip.id;
              const countInCategory = chipMetrics.counts[chip.id];
              const activeBg = colors.accent.default;
              const activeFg = colors.accent.onAccent;
              const chipHasUnread = chipMetrics.hasUnread[chip.id];

              return (
                <Pressable
                  key={chip.id}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setActiveFilter(chip.id);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? activeBg : colors.background.secondary,
                      borderColor: active ? activeBg : colors.border.subtle,
                    },
                  ]}
                >
                  <View style={styles.chipInner}>
                    {chipHasUnread && !active ? (
                      <View style={[styles.chipUnreadDot, { backgroundColor: colors.accent.default }]} />
                    ) : null}
                    <Text style={[styles.chipText, { color: active ? activeFg : colors.text.secondary }]}>
                      {chip.label}
                    </Text>
                    {countInCategory > 0 ? (
                      <View
                        style={[
                          styles.chipCounter,
                          { backgroundColor: active ? colors.accent.onAccent : colors.background.secondary },
                        ]}
                      >
                        <Text style={[styles.chipCounterText, { color: active ? colors.accent.default : colors.text.tertiary }]}>
                          {countInCategory}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {(() => {
          const hasError = !!notificationsQuery.error;
          const isQueryLoading = notificationsQuery.isLoading;
          const hasData = filteredData.length > 0;
          const listErrorMessage =
            notificationsQuery.error instanceof Error
              ? notificationsQuery.error.message
              : 'Please check your connection.';

          if (isQueryLoading) {
            return (
              <View style={{ paddingTop: 16 }}>
                <NotificationsSkeleton />
              </View>
            );
          }

          if (hasError) {
            return (
              <StateBlock
                kind="error"
                title="Could not load notifications"
                message={listErrorMessage}
                actionLabel="Retry"
                onAction={() => notificationsQuery.refetch()}
              />
            );
          }

          if (!hasData) {
            return (
              <StateBlock
                kind="empty"
                title="No notifications"
                message={
                  activeFilter === 'all'
                    ? 'Announcements, promotion milestones, and streaks will appear here.'
                    : `You have no notifications in the "${activeFilter}" category.`
                }
              />
            );
          }

          return (
            <View style={styles.listContainer}>
              {renderSection('Today', grouped.today)}
              {renderSection('Yesterday', grouped.yesterday)}
              {renderSection('This Week', grouped.thisWeek)}
              {renderSection('Older', grouped.older)}
            </View>
          );
        })()}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  heroActions: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  markAllButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  floatingNav: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
  },
  floatingNavRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  floatingNavButton: {
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  floatingNavButtonInner: {
    flex: 1,
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  floatingNavTitleWrap: {
    flex: 1,
    paddingHorizontal: 12,
  },
  floatingNavSide: {
    alignItems: 'flex-end',
    minWidth: NAV_CHROME.clusterHeight,
  },
  scrollContent: {
    flexGrow: 1,
  },
  filterScroll: {
    gap: 8,
    marginBottom: 20,
    paddingRight: 16,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 0.5,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  chipInner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  chipUnreadDot: {
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipCounter: {
    alignItems: 'center',
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  chipCounterText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  listContainer: {
    gap: 20,
  },
  sectionWrap: {
    gap: 10,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  sectionHeaderText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  sectionLine: {
    flex: 1,
    height: 0.5,
  },
  sectionList: {
    gap: 8,
  },
  rowPressable: {
    width: '100%',
  },
  rowContainer: {
    width: '100%',
  },
  rowLayout: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  rowIcon: {
    flexShrink: 0,
  },
  contentCol: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowTop: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  unreadDot: {
    borderRadius: 4,
    flexShrink: 0,
    height: 8,
    width: 8,
  },
});
