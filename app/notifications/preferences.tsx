import React, { useCallback } from 'react';
import { RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/features/notifications/hooks/useNotifications';
import { AppBar, AppScrollView, Card } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { NotificationPreferences } from '@/types/domain';

type PreferenceKey =
  | 'announcements'
  | 'classReminders'
  | 'milestones'
  | 'rewards'
  | 'guardianAlerts'
  | 'community';

type PreferenceRowConfig = {
  key: PreferenceKey;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const PREFERENCE_ROWS: PreferenceRowConfig[] = [
  {
    key: 'announcements',
    title: 'Academy announcements',
    subtitle: 'Coach and academy broadcasts',
    icon: 'megaphone-outline',
  },
  {
    key: 'classReminders',
    title: 'Class updates',
    subtitle: 'Reminders and schedule changes',
    icon: 'calendar-outline',
  },
  {
    key: 'milestones',
    title: 'Milestones and rank',
    subtitle: 'Promotions, streaks, and progress',
    icon: 'ribbon-outline',
  },
  {
    key: 'rewards',
    title: 'Rewards',
    subtitle: 'Points, redemptions, and offers',
    icon: 'gift-outline',
  },
  {
    key: 'guardianAlerts',
    title: 'Guardian alerts',
    subtitle: 'Child check-ins and trainee updates',
    icon: 'people-outline',
  },
  {
    key: 'community',
    title: 'Community',
    subtitle: 'Discipline channel activity',
    icon: 'chatbubbles-outline',
  },
];

function PreferenceRow({
  config,
  value,
  disabled,
  onChange,
}: {
  config: PreferenceRowConfig;
  value: boolean;
  disabled: boolean;
  onChange: (key: PreferenceKey, value: boolean) => void;
}) {
  const { colors, typography, inset, radius } = useTheme();

  return (
    <View style={[styles.preferenceRow, { paddingVertical: inset.sm + 2, gap: inset.sm }]}>
      <View style={[styles.iconWell, { backgroundColor: colors.background.secondary, borderRadius: radius.pill }]}>
        <Ionicons name={config.icon} size={19} color={colors.text.secondary} />
      </View>

      <View style={styles.preferenceCopy}>
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]} numberOfLines={1}>
          {config.title}
        </Text>
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]} numberOfLines={1}>
          {config.subtitle}
        </Text>
      </View>

      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(config.key, next)}
        trackColor={{ false: colors.fill.secondary, true: colors.accent.default }}
        thumbColor={colors.surface.primary}
        ios_backgroundColor={colors.fill.secondary}
      />
    </View>
  );
}

function preferencePatch(key: PreferenceKey, value: boolean): Partial<NotificationPreferences> {
  return { [key]: value } as Partial<NotificationPreferences>;
}

export default function NotificationPreferencesScreen() {
  const { colors, inset, gap, typography } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const preferencesQuery = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  const preferences = preferencesQuery.data;
  const disabled = updatePreferences.isPending;
  const appBarBottomInset = inset.sm;
  const floatingAppBarOffset = 72 + appBarBottomInset;

  const onChange = useCallback(
    (key: PreferenceKey, value: boolean) => {
      triggerSelectionHaptic();
      updatePreferences.mutate(preferencePatch(key, value));
    },
    [updatePreferences],
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['left', 'right']}
    >
      <AppBar title="Notification Preferences" floating bottomInset={appBarBottomInset} />

      <AppScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: safeInsets.top + floatingAppBarOffset,
            paddingHorizontal: inset.lg,
            paddingBottom: safeInsets.bottom + inset['3xl'],
            gap: gap.lg,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={preferencesQuery.isRefetching}
            onRefresh={() => preferencesQuery.refetch()}
            tintColor={colors.accent.default}
          />
        }
      >
        <View style={{ gap: gap.xs }}>
          <Text style={[typography.textPresets.homeHero, { color: colors.text.primary, lineHeight: 42 }]}>
            Choose your{' '}
            <Text style={{ color: colors.accent.default }}>signals.</Text>
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            These preferences shape in-app and push notifications.
          </Text>
        </View>

        {preferencesQuery.isLoading ? (
          <StateBlock kind="loading" title="Loading preferences" />
        ) : preferencesQuery.isError || !preferences ? (
          <StateBlock
            kind="error"
            title="Could not load preferences"
            message="Please check your connection and try again."
            actionLabel="Retry"
            onAction={() => preferencesQuery.refetch()}
          />
        ) : (
          <Card style={{ paddingVertical: inset.xs }}>
            {PREFERENCE_ROWS.map((row, index) => (
              <React.Fragment key={row.key}>
                <PreferenceRow
                  config={row}
                  value={preferences[row.key]}
                  disabled={disabled}
                  onChange={onChange}
                />
                {index < PREFERENCE_ROWS.length - 1 ? (
                  <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />
                ) : null}
              </React.Fragment>
            ))}
          </Card>
        )}
      </AppScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1 },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    maxWidth: 340,
  },
  preferenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 60,
  },
  preferenceCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  iconWell: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 50,
  },
});
