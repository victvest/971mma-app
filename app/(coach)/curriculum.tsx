import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppBar, AppScrollView, BrandedButton } from '@/shared/components/ui';
import { BeltPathSectionTitle } from '@/features/belt/components/BeltPathSectionTitle';
import {
  CoachCurriculumRequirementEditor,
  type CoachCurriculumRequirementDraft,
} from '@/features/coach/components/curriculum/CoachCurriculumRequirementEditor';
import { CommunityGroupsFab } from '@/features/communities/components/CommunityAnnouncementSheet';
import {
  useCoachRankCurriculum,
  useDeleteCoachRankRequirement,
  useUpsertCoachRankRequirement,
} from '@/features/coach/hooks/useCoachCurriculum';
import {
  useCoachAssignedDisciplines,
  type RankDisciplineSlug,
} from '@/features/coach/hooks/useCoachAssignedDisciplines';
import { StateBlock } from '@/shared/components/StateBlock';
import { toast } from '@/shared/components/Toast';
import { useDialog } from '@/shared/components/Dialog/useDialog';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { CoachCurriculumRequirement } from '@/types/domain';

function groupRequirements(requirements: CoachCurriculumRequirement[]) {
  const groups = new Map<string, CoachCurriculumRequirement[]>();

  for (const item of requirements) {
    const key = `${item.rankName} · Stripe ${item.stripe}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  return [...groups.entries()];
}

export default function CoachCurriculumScreen() {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const router = useRouter();
  const { showConfirm } = useDialog();
  const assignedDisciplinesQuery = useCoachAssignedDisciplines();
  const rankDisciplines = assignedDisciplinesQuery.rankDisciplines;
  const [disciplineSlug, setDisciplineSlug] = useState<RankDisciplineSlug | null>(null);
  const activeDisciplineSlug =
    disciplineSlug ??
    assignedDisciplinesQuery.primaryRankDisciplineSlug ??
    (rankDisciplines[0]?.slug as RankDisciplineSlug | undefined) ??
    null;

  const curriculumQuery = useCoachRankCurriculum(
    activeDisciplineSlug,
    Boolean(activeDisciplineSlug) && !assignedDisciplinesQuery.isLoading,
  );
  const upsertMutation = useUpsertCoachRankRequirement(activeDisciplineSlug);
  const deleteMutation = useDeleteCoachRankRequirement(activeDisciplineSlug);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<CoachCurriculumRequirement | null>(
    null,
  );

  const groupedRequirements = useMemo(
    () => groupRequirements(curriculumQuery.data?.requirements ?? []),
    [curriculumQuery.data?.requirements],
  );

  const openCreateEditor = useCallback(() => {
    setEditingRequirement(null);
    setEditorOpen(true);
  }, []);

  const openEditEditor = useCallback((requirement: CoachCurriculumRequirement) => {
    setEditingRequirement(requirement);
    setEditorOpen(true);
  }, []);

  const handleSaveRequirement = useCallback(
    (draft: CoachCurriculumRequirementDraft) => {
      const attendanceTarget =
        draft.requirementType === 'attendance' && draft.attendanceTarget.trim()
          ? Number.parseInt(draft.attendanceTarget, 10)
          : null;

      upsertMutation.mutate(
        {
          requirementId: draft.requirementId,
          rankLevelId: draft.rankLevelId,
          stripe: draft.stripe,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          requirementType: draft.requirementType,
          attendanceTarget: Number.isFinite(attendanceTarget) ? attendanceTarget : null,
          sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
        },
        {
          onSuccess: () => {
            setEditorOpen(false);
            setEditingRequirement(null);
            toast.success('Requirement saved');
          },
          onError: () => {
            toast.error('Could not save', 'Please try again.');
          },
        },
      );
    },
    [upsertMutation],
  );

  const handleDeleteRequirement = useCallback(
    (requirement: CoachCurriculumRequirement) => {
      showConfirm(
        'Delete requirement?',
        `"${requirement.title}" will be removed from the belt path.`,
        () => {
          deleteMutation.mutate(requirement.id, {
            onSuccess: () => toast.success('Requirement deleted'),
            onError: () => toast.error('Could not delete', 'Please try again.'),
          });
        },
        { confirmLabel: 'Delete', destructive: true },
      );
    },
    [deleteMutation, showConfirm],
  );

  const ranks = curriculumQuery.data?.ranks ?? [];
  const hasRankDiscipline = rankDisciplines.length > 0;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      <AppBar title="Curriculum" showBackButton />

      {assignedDisciplinesQuery.isLoading ? (
        <StateBlock kind="loading" title="Loading your disciplines" />
      ) : !hasRankDiscipline ? (
        <View style={{ padding: inset.lg }}>
          <StateBlock
            kind="empty"
            title="No rank disciplines assigned"
            message="Academy staff must link your coach profile to BJJ or Wrestling before you can manage requirements."
          />
        </View>
      ) : (
        <View style={styles.body}>
          <AppScrollView
            style={styles.flex}
            contentContainerStyle={{
              paddingHorizontal: inset.lg,
              paddingTop: inset.lg,
              paddingBottom: inset['3xl'] + 72,
              gap: gap.lg,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: gap.xs }}>
              <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
                Stripe requirements
              </Text>
              <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
                Define what members must complete before earning their next stripe in your discipline.
              </Text>
            </View>

            {rankDisciplines.length > 1 ? (
              <View style={[styles.row, { gap: gap.sm }]}>
                {rankDisciplines.map((discipline) => {
                  const selected = discipline.slug === activeDisciplineSlug;
                  return (
                    <Pressable
                      key={discipline.id}
                      onPress={() => {
                        triggerLightImpact();
                        setDisciplineSlug(discipline.slug as RankDisciplineSlug);
                      }}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? colors.accent.default : colors.background.secondary,
                          borderColor: selected ? colors.accent.default : colors.border.subtle,
                          borderRadius: radius.pill,
                          borderWidth: layout.borderWidth,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.textPresets.captionMedium,
                          {
                            color: selected ? colors.accent.onAccent : colors.text.secondary,
                          },
                        ]}
                      >
                        {discipline.displayName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {curriculumQuery.isLoading ? (
              <StateBlock kind="loading" title="Loading curriculum" />
            ) : curriculumQuery.isError ? (
              <StateBlock
                kind="error"
                title="Could not load curriculum"
                actionLabel="Retry"
                onAction={() => curriculumQuery.refetch()}
              />
            ) : ranks.length === 0 ? (
              <StateBlock
                kind="empty"
                title="No ranks configured"
                message="Academy staff must set up belt ranks before you can add requirements."
              />
            ) : groupedRequirements.length === 0 ? (
              <StateBlock
                kind="empty"
                title="No requirements yet"
                message="Add skill, assessment, or attendance targets for each stripe."
                actionLabel="Add requirement"
                onAction={openCreateEditor}
              />
            ) : (
              groupedRequirements.map(([sectionTitle, items]) => (
                <View key={sectionTitle} style={{ gap: gap.md }}>
                  <BeltPathSectionTitle title={sectionTitle} />
                  {items.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.requirementCard,
                        {
                          backgroundColor: colors.surface.secondary,
                          borderColor: colors.border.subtle,
                          borderRadius: radius.card,
                          borderWidth: layout.borderWidth,
                          padding: inset.md,
                          gap: gap.sm,
                        },
                      ]}
                    >
                      <View style={styles.requirementHeader}>
                        <View style={{ flex: 1, gap: gap.xs }}>
                          <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
                            {item.title}
                          </Text>
                          {item.description ? (
                            <Text
                              style={[typography.textPresets.footnote, { color: colors.text.secondary }]}
                            >
                              {item.description}
                            </Text>
                          ) : null}
                        </View>
                        <View style={[styles.actions, { gap: gap.sm }]}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Edit requirement"
                            onPress={() => openEditEditor(item)}
                            hitSlop={8}
                          >
                            <Ionicons name="create-outline" size={18} color={colors.text.secondary} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Delete requirement"
                            onPress={() => handleDeleteRequirement(item)}
                            hitSlop={8}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                          </Pressable>
                        </View>
                      </View>
                      <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
                        {item.requirementType}
                        {item.requirementType === 'attendance' && item.attendanceTarget
                          ? ` · ${item.attendanceTarget} classes`
                          : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              ))
            )}

            <BrandedButton
              label="Open belt review"
              variant="secondary"
              full
              onPress={() => router.push('/(coach)/belt-review')}
            />
          </AppScrollView>

          {ranks.length > 0 && !editorOpen ? (
            <CommunityGroupsFab
              icon="add"
              accessibilityLabel="Add requirement"
              onPress={openCreateEditor}
            />
          ) : null}
        </View>
      )}

      <CoachCurriculumRequirementEditor
        visible={editorOpen}
        ranks={ranks}
        initialValue={editingRequirement}
        saving={upsertMutation.isPending}
        onDismiss={() => {
          setEditorOpen(false);
          setEditingRequirement(null);
        }}
        onSave={handleSaveRequirement}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1 },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  requirementCard: {},
  requirementHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
