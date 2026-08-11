import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnnouncementAudiencePicker } from '@/features/announcements/components/AnnouncementAudiencePicker';
import { AnnouncementClassTargetList } from '@/features/announcements/components/AnnouncementClassTargetList';
import {
  useCoachAnnouncementTargets,
  useCoachSendAnnouncement,
} from '@/features/announcements/hooks/useAnnouncements';
import type { CoachAnnouncementAudienceMode } from '@/services/database/announcements.repository';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import { StateBlock } from '@/shared/components/StateBlock';
import { toast } from '@/shared/components/Toast';
import {
  AppBar,
  AppSafeAreaView,
  AppScrollView,
  BrandedButton,
  TextField,
} from '@/shared/components/ui';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { useTheme } from '@/shared/theme';
import {
  toUserFacingErrorMessage,
  USER_FACING_LOAD_ERROR,
  USER_FACING_SAVE_ERROR,
} from '@/lib/userFacingError';

const TITLE_MAX = 80;
const BODY_MAX = 500;

export function CoachPostAnnouncementScreen() {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const appTopInset = useAppTopInset();
  const router = useRouter();
  const targetsQuery = useCoachAnnouncementTargets();
  const sendMutation = useCoachSendAnnouncement();

  const [mode, setMode] = useState<CoachAnnouncementAudienceMode>('general');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const appBarBottomInset = inset.sm;
  const floatingAppBarOffset = 72 + appBarBottomInset;

  const classes = targetsQuery.data?.classes ?? [];
  const generalCount = targetsQuery.data?.generalRecipientCount ?? 0;

  const selectedRecipientCount = useMemo(() => {
    if (mode === 'general') return generalCount;
    const selected = classes.filter((item) => selectedIds.has(item.id));
    // Unique members across selected classes aren't known client-side without another RPC.
    // Sum is an upper bound used for guidance; server still de-dupes on send.
    return selected.reduce((sum, item) => sum + item.rosterCount, 0);
  }, [classes, generalCount, mode, selectedIds]);

  const canPublish =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (mode === 'general' || selectedIds.size > 0) &&
    !sendMutation.isPending;

  const recipientSummary = useMemo(() => {
    if (mode === 'general') {
      if (generalCount === 0) {
        return 'No members on your class swipe lists yet. Publish will reach 0 people until rosters are built.';
      }
      return `About ${generalCount} member${generalCount === 1 ? '' : 's'} will be notified across your class swipe lists.`;
    }
    if (selectedIds.size === 0) {
      return 'Select one or more classes to target their swipe lists.';
    }
    return `About ${selectedRecipientCount} member${selectedRecipientCount === 1 ? '' : 's'} will be notified across the selected classes.`;
  }, [generalCount, mode, selectedIds.size, selectedRecipientCount]);

  const toggleClass = useCallback((classId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }, []);

  const handlePublish = useCallback(() => {
    if (!canPublish) return;

    sendMutation.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        mode,
        classIds: mode === 'classes' ? [...selectedIds] : undefined,
      },
      {
        onSuccess: (result) => {
          toast.success(
            result.recipientCount > 0
              ? `Published to ${result.recipientCount} member${result.recipientCount === 1 ? '' : 's'}`
              : 'Announcement published',
          );
          router.back();
        },
        onError: (error) => {
          toast.error(
            toUserFacingErrorMessage(error, { fallback: USER_FACING_SAVE_ERROR }),
          );
        },
      },
    );
  }, [canPublish, mode, router, selectedIds, sendMutation, title, body]);

  return (
    <AppSafeAreaView
      edges={['bottom']}
      style={[styles.flex, { backgroundColor: colors.background.primary }]}
    >
      <AppBar
        title=" "
        showBackButton
        floating
        bottomInset={appBarBottomInset}
        onBackPress={() => router.back()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        {targetsQuery.isLoading ? (
          <View
            style={{
              flex: 1,
              padding: inset.lg,
              paddingTop: appTopInset + floatingAppBarOffset,
            }}
          >
            <StateBlock kind="loading" title="Loading audience" />
          </View>
        ) : targetsQuery.isError ? (
          <View
            style={[
              styles.flex,
              {
                paddingHorizontal: inset.lg,
                paddingTop: appTopInset + floatingAppBarOffset,
                justifyContent: 'center',
              },
            ]}
          >
            <StateBlock
              kind="error"
              title="Could not load classes"
              message={toUserFacingErrorMessage(targetsQuery.error, {
                fallback: USER_FACING_LOAD_ERROR,
              })}
              actionLabel="Retry"
              onAction={() => targetsQuery.refetch()}
            />
          </View>
        ) : (
          <>
            <AppScrollView
              style={styles.flex}
              contentContainerStyle={{
                paddingHorizontal: inset.lg,
                paddingTop: appTopInset + floatingAppBarOffset,
                paddingBottom: inset.xl,
                gap: gap.xl,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ gap: gap.sm }}>
                <AcademyEyebrow label="Coach announcements" accent showFlag={false} />
                <TabHeroTitle
                  lines={[[{ text: 'Reach ' }, { text: 'your members.', accent: true }]]}
                />
              </View>

              <View style={{ gap: gap.sm }}>
                <Text style={[typography.textPresets.title, { color: colors.text.primary }]}>
                  Audience
                </Text>
                <Text style={[typography.textPresets.caption, { color: colors.text.secondary }]}>
                  Who receives this notification.
                </Text>
                <AnnouncementAudiencePicker value={mode} onChange={setMode} />
              </View>

              {mode === 'classes' ? (
                <View style={{ gap: gap.sm }}>
                  <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
                    Classes
                  </Text>
                  <Text style={[typography.textPresets.caption, { color: colors.text.secondary }]}>
                    Members currently on each class swipe list.
                  </Text>
                  <AnnouncementClassTargetList
                    classes={classes}
                    selectedIds={selectedIds}
                    onToggle={toggleClass}
                  />
                </View>
              ) : null}

              <View style={{ gap: gap.md }}>
                <View style={{ gap: gap.xs }}>
                  <Text style={[typography.textPresets.title, { color: colors.text.primary }]}>
                    Message
                  </Text>
                  <Text style={[typography.textPresets.caption, { color: colors.text.secondary }]}>
                    Compose the push notification content.
                  </Text>
                </View>
                <TextField
                  label="Announcement title"
                  value={title}
                  onChangeText={(value) => setTitle(value.slice(0, TITLE_MAX))}
                  placeholder="e.g., Seminar with Guest Coach"
                  maxLength={TITLE_MAX}
                />
                <TextField
                  label="Message body"
                  value={body}
                  onChangeText={(value) => setBody(value.slice(0, BODY_MAX))}
                  placeholder="Write your announcement here…"
                  multiline
                  maxLength={BODY_MAX}
                />
              </View>

              <View
                style={[
                  styles.summary,
                  {
                    backgroundColor: colors.surface.secondary,
                    borderRadius: radius.card,
                    borderColor: colors.border.subtle,
                    borderWidth: layout.borderWidth,
                    padding: inset.md,
                    gap: gap.sm,
                  },
                ]}
              >
                <Ionicons name="information-circle-outline" size={18} color={colors.text.secondary} />
                <Text
                  style={[
                    typography.textPresets.caption,
                    styles.summaryText,
                    { color: colors.text.secondary },
                  ]}
                >
                  {recipientSummary}
                </Text>
              </View>
            </AppScrollView>

            <View
              style={[
                styles.footer,
                {
                  borderTopColor: colors.border.subtle,
                  paddingHorizontal: inset.lg,
                  paddingTop: inset.md,
                  paddingBottom: inset.md,
                  backgroundColor: colors.background.primary,
                },
              ]}
            >
              <BrandedButton
                label="Publish announcement"
                onPress={handlePublish}
                loading={sendMutation.isPending}
                disabled={!canPublish}
                icon="send"
              />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  summaryText: {
    flex: 1,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
