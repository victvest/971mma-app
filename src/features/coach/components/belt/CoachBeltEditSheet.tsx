import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBottomSheet } from '@/shared/components/AppBottomSheet';
import {
  useAwardPromotion,
  useCoachMemberBeltPath,
} from '@/features/belt/hooks/useBeltPath';
import { StateBlock } from '@/shared/components/StateBlock';
import { triggerLightImpact, triggerSuccessNotification } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { toast } from '@/shared/components/Toast';
import { toUserFacingErrorMessage } from '@/lib/userFacingError';
import type { BeltRankItem } from '@/types/domain';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  member: {
    id: string;
    fullName: string;
    beltRank: string | null;
    beltStripes: number;
  } | null;
  disciplineSlug?: string;
  onSaveSuccess?: () => void;
};

export const CoachBeltEditSheet = memo(function CoachBeltEditSheet({
  visible,
  onDismiss,
  member,
  disciplineSlug = 'bjj',
  onSaveSuccess,
}: Props) {
  const { colors, typography, inset, radius, gap, layout } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedRankId, setSelectedRankId] = useState<string | null>(null);
  const [selectedStripe, setSelectedStripe] = useState<number>(0);
  const [initialized, setInitialized] = useState(false);

  // Fetch belt progress details, which includes the list of ranks
  const beltPathQuery = useCoachMemberBeltPath(member?.id ?? null, disciplineSlug);
  const awardMutation = useAwardPromotion(member?.id ?? null);

  const ranks = beltPathQuery.data?.curriculumRanks ?? [];
  const currentRankId = beltPathQuery.data?.progress?.rankId ?? null;
  const currentStripe = beltPathQuery.data?.progress?.stripe ?? 0;

  // Initialize selected values from member's current status
  useEffect(() => {
    if (!visible) {
      setInitialized(false);
      return;
    }

    if (visible && !initialized && beltPathQuery.isSuccess && beltPathQuery.data?.progress) {
      const progress = beltPathQuery.data.progress;
      setSelectedRankId(progress.rankId);
      setSelectedStripe(progress.stripe);
      setInitialized(true);
    }
  }, [visible, initialized, beltPathQuery.isSuccess, beltPathQuery.data]);

  const handleRankSelect = useCallback((rankId: string) => {
    triggerLightImpact();
    setSelectedRankId(rankId);
    // Reset stripes if it exceeds the new rank's max stripes
    const targetRank = ranks.find((r) => r.id === rankId);
    const maxStripes = targetRank?.stripes ?? 4;
    setSelectedStripe((curr) => Math.min(curr, maxStripes));
  }, [ranks]);

  const handleStripeSelect = useCallback((stripe: number) => {
    triggerLightImpact();
    setSelectedStripe(stripe);
  }, []);

  const handleSave = useCallback(async () => {
    if (!member || !selectedRankId) return;

    try {
      triggerLightImpact();
      await awardMutation.mutateAsync({
        toRankId: selectedRankId,
        toStripe: selectedStripe,
        discipline: disciplineSlug,
      });

      triggerSuccessNotification();
      toast.success(
        'Rank updated',
        `${member.fullName} is now ${
          ranks.find((r) => r.id === selectedRankId)?.name ?? ''
        } belt, stripe ${selectedStripe}.`
      );

      if (onSaveSuccess) {
        onSaveSuccess();
      }
      onDismiss();
    } catch (error) {
      toast.error(
        'Could not update rank',
        toUserFacingErrorMessage(error, { fallback: 'Please try again.' })
      );
    }
  }, [member, selectedRankId, selectedStripe, disciplineSlug, awardMutation, ranks, onSaveSuccess, onDismiss]);

  const selectedRank = ranks.find((r) => r.id === selectedRankId);
  const maxStripes = selectedRank?.stripes ?? 4;

  const getBeltColorStyle = (rankName: string) => {
    const name = rankName.toLowerCase();
    if (name.includes('white')) {
      return {
        bg: '#FFFFFF',
        text: '#111827',
        border: colors.border.default,
        sleeve: '#111827',
      };
    }
    if (name.includes('blue')) {
      return {
        bg: '#1E40AF',
        text: '#FFFFFF',
        border: 'transparent',
        sleeve: '#111827',
      };
    }
    if (name.includes('purple')) {
      return {
        bg: '#6B21A8',
        text: '#FFFFFF',
        border: 'transparent',
        sleeve: '#111827',
      };
    }
    if (name.includes('brown')) {
      return {
        bg: '#78350F',
        text: '#FFFFFF',
        border: 'transparent',
        sleeve: '#111827',
      };
    }
    if (name.includes('black')) {
      return {
        bg: '#111827',
        text: '#FFFFFF',
        border: '#374151',
        sleeve: '#DC2626', // Red sleeve for BJJ black belt
      };
    }
    // Fallback
    return {
      bg: colors.fill.secondary,
      text: colors.text.primary,
      border: colors.border.subtle,
      sleeve: colors.text.secondary,
    };
  };

  return (
    <AppBottomSheet visible={visible} onDismiss={onDismiss}>
      <View style={[styles.header, { gap: gap.xs }]}>
        <Text style={[typography.textPresets.title, { color: colors.text.primary }]}>
          Update Belt & Stripes
        </Text>
        {member ? (
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            {member.fullName}
          </Text>
        ) : null}
      </View>

      {beltPathQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent.default} />
        </View>
      ) : beltPathQuery.isError ? (
        <StateBlock
          kind="error"
          title="Could not load rank details"
          message={toUserFacingErrorMessage(beltPathQuery.error, {
            fallback: 'Verify internet connection and try again.',
          })}
          actionLabel="Retry"
          onAction={() => beltPathQuery.refetch()}
        />
      ) : (
        <View style={[styles.body, { gap: gap.lg }]}>
          {/* Belt Color Selector */}
          <View style={{ gap: gap.sm }}>
            <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
              Select Belt Color
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.ranksScroll, { gap: gap.sm }]}
            >
              {ranks.map((rank) => {
                const isSelected = selectedRankId === rank.id;
                const isCurrent = currentRankId === rank.id;
                const visual = getBeltColorStyle(rank.name);

                return (
                  <Pressable
                    key={rank.id}
                    onPress={() => handleRankSelect(rank.id)}
                    style={[
                      styles.beltPill,
                      {
                        backgroundColor: visual.bg,
                        borderColor: isSelected
                          ? colors.accent.default
                          : visual.border === 'transparent'
                            ? 'transparent'
                            : visual.border,
                        borderWidth: isSelected ? 2.5 : 1,
                        borderRadius: radius.card,
                        height: 52,
                      },
                    ]}
                  >
                    {/* Sleeve representing BJJ belt rank style */}
                    <View style={[styles.sleeve, { backgroundColor: visual.sleeve, borderTopRightRadius: radius.card - 1, borderBottomRightRadius: radius.card - 1 }]} />

                    <View style={styles.beltContent}>
                      <Text
                        style={[
                          typography.textPresets.bodyStrong,
                          {
                            color: visual.text,
                            marginRight: 24, // Leave space for sleeve
                          },
                        ]}
                      >
                        {rank.name}
                      </Text>
                      {isCurrent ? (
                        <View style={[styles.currentIndicator, { backgroundColor: visual.text + '30' }]}>
                          <Text style={[typography.textPresets.caption, { color: visual.text, fontSize: 10, fontWeight: '700' }]}>
                            ACTIVE
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Stripe Selector */}
          <View style={{ gap: gap.sm }}>
            <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
              Select Stripes
            </Text>
            <View style={[styles.stripeRow, { gap: gap.md }]}>
              {Array.from({ length: maxStripes + 1 }, (_, index) => {
                const isSelected = selectedStripe === index;
                const isCurrent = currentRankId === selectedRankId && currentStripe === index;

                return (
                  <Pressable
                    key={index}
                    onPress={() => handleStripeSelect(index)}
                    style={({ pressed }) => [
                      styles.stripeCircle,
                      {
                        borderColor: isSelected ? colors.accent.default : colors.border.default,
                        backgroundColor: isSelected ? colors.accent.subtle : colors.surface.secondary,
                        borderWidth: isSelected ? 2 : 1,
                        borderRadius: radius.pill,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.textPresets.bodyStrong,
                        { color: isSelected ? colors.accent.default : colors.text.primary },
                      ]}
                    >
                      {index}
                    </Text>
                    {isCurrent ? (
                      <Text style={[typography.textPresets.caption, { color: colors.text.tertiary, fontSize: 8, position: 'absolute', bottom: 4 }]}>
                        NOW
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={[styles.actions, { gap: gap.sm, marginTop: gap.sm }]}>
            <Pressable
              onPress={handleSave}
              disabled={awardMutation.isPending}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor: colors.accent.default,
                  borderRadius: radius.pill,
                  minHeight: layout.coachActionHeight,
                  opacity: pressed || awardMutation.isPending ? 0.88 : 1,
                },
              ]}
            >
              {awardMutation.isPending ? (
                <ActivityIndicator color={colors.accent.onAccent} />
              ) : (
                <Text style={[typography.textPresets.button, { color: colors.accent.onAccent }]}>
                  Save Changes
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={onDismiss}
              disabled={awardMutation.isPending}
              style={styles.cancelButton}
            >
              <Text style={[typography.textPresets.button, { color: colors.text.secondary }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </AppBottomSheet>
  );
});

const styles = StyleSheet.create({
  header: {
    paddingBottom: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  body: {
    width: '100%',
  },
  ranksScroll: {
    paddingVertical: 4,
  },
  beltPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    minWidth: 150,
    position: 'relative',
    overflow: 'hidden',
  },
  sleeve: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
  },
  beltContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currentIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 36,
  },
  stripeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  stripeCircle: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  actions: {
    width: '100%',
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    width: '100%',
  },
});
