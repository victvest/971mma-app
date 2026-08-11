import React, { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppBottomSheet } from '@/shared/components/AppBottomSheet';
import { CoachBeltEditSheet } from '@/features/coach/components/belt/CoachBeltEditSheet';
import { initialsFromName } from '@/features/onboarding/services/onboardingValidation';
import { resolveRollCallMemberAvatar } from '@/features/coach/roll-call/utils/rollCallAvatarUrl';
import { useTheme } from '@/shared/theme';
import type { ScannedMember } from '@/features/coach/hooks/useBeltReviewHub';

const AVATAR_SIZE = 64;

function formatBelt(beltRank: string | null, beltStripes: number): string {
  if (!beltRank?.trim()) return 'Unranked';
  const stripe = beltStripes === 1 ? '1 stripe' : `${beltStripes} stripes`;
  return `${beltRank.trim()} · ${stripe}`;
}

type Props = {
  member: ScannedMember | null;
  visible: boolean;
  onDismiss: () => void;
};

export const ScannedMemberSheet = memo(function ScannedMemberSheet({
  member,
  visible,
  onDismiss,
}: Props) {
  const { colors, typography, inset, gap, radius } = useTheme();
  const [editVisible, setEditVisible] = useState(false);

  const initials = useMemo(
    () => (member ? initialsFromName(member.fullName) : ''),
    [member?.fullName],
  );
  const avatarUrl = useMemo(
    () =>
      member
        ? resolveRollCallMemberAvatar({
            avatarUrl: member.avatarUrl,
            displayName: member.fullName,
          })
        : null,
    [member?.avatarUrl, member?.fullName],
  );
  const beltLine = useMemo(
    () => (member ? formatBelt(member.beltRank, member.beltStripes) : ''),
    [member?.beltRank, member?.beltStripes],
  );

  if (!member) return null;

  return (
    <>
      <AppBottomSheet visible={visible} onDismiss={onDismiss}>
        <View style={{ gap: gap.lg }}>
          {/* Member hero */}
          <View style={[styles.hero, { gap: gap.md }]}>
            <View
              style={[
                styles.avatar,
                {
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: AVATAR_SIZE / 2,
                  backgroundColor: colors.accent.subtle,
                },
              ]}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <Text
                  style={[typography.textPresets.subtitle, { color: colors.accent.default }]}
                >
                  {initials}
                </Text>
              )}
            </View>

            <View style={{ flex: 1, gap: gap.xs }}>
              <Text
                style={[typography.textPresets.subtitle, { color: colors.text.primary }]}
                numberOfLines={2}
              >
                {member.fullName}
              </Text>
              <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
                {beltLine}
              </Text>
            </View>
          </View>

          {/* Classes enrolled */}
          {member.classNames.length > 0 && (
            <View style={{ gap: gap.sm }}>
              <Text
                style={[
                  typography.textPresets.captionMedium,
                  { color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.8 },
                ]}
              >
                Classes
              </Text>
              {member.classNames.map((name) => (
                <View
                  key={name}
                  style={[
                    styles.classRow,
                    {
                      backgroundColor: colors.surface.secondary,
                      borderRadius: radius.card,
                      paddingHorizontal: inset.md,
                      paddingVertical: inset.sm,
                      gap: gap.sm,
                      borderColor: colors.border.subtle,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Ionicons name="barbell-outline" size={15} color={colors.accent.default} />
                  <Text
                    style={[
                      typography.textPresets.bodyMedium,
                      { color: colors.text.primary, flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Edit belt action */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setEditVisible(true)}
            accessibilityLabel="Edit belt rank"
            style={[
              styles.editBtn,
              {
                backgroundColor: colors.surface.secondary,
                borderRadius: radius.card,
                paddingHorizontal: inset.lg,
                paddingVertical: inset.md,
                borderColor: colors.border.default,
                borderWidth: StyleSheet.hairlineWidth,
                gap: gap.sm,
              },
            ]}
          >
            <Ionicons name="create-outline" size={18} color={colors.text.primary} />
            <Text style={[typography.textPresets.bodyMedium, { color: colors.text.primary }]}>
              Edit belt & stripes
            </Text>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>

      {/* Nested belt edit sheet */}
      <CoachBeltEditSheet
        visible={editVisible}
        onDismiss={() => setEditVisible(false)}
        onSaveSuccess={() => {
          setEditVisible(false);
          onDismiss();
        }}
        member={
          member
            ? {
                id: member.userId,
                fullName: member.fullName,
                beltRank: member.beltRank,
                beltStripes: member.beltStripes,
              }
            : null
        }
        disciplineSlug="bjj"
      />
    </>
  );
});

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
