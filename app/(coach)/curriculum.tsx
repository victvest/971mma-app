import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import {
  AppBar,
  AppBarIconButton,
  AppSafeAreaView,
  AppScrollView,
  PillSegmentedTabs,
} from '@/shared/components/ui';
import { CoachCurriculumRequirementCard } from '@/features/coach/components/curriculum/CoachCurriculumRequirementCard';
import {
  CoachCurriculumRequirementEditor,
  type CoachCurriculumRequirementDraft,
} from '@/features/coach/components/curriculum/CoachCurriculumRequirementEditor';
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
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
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
  const { colors, typography, inset, gap } = useTheme();
  const appTopInset = useAppTopInset();
  const { showConfirm } = useDialog();
  const assignedDisciplinesQuery = useCoachAssignedDisciplines();
  const rankDisciplines = assignedDisciplinesQuery.rankDisciplines;
  const [disciplineSlug, setDisciplineSlug] = useState<RankDisciplineSlug | null>(null);
  const activeDisciplineSlug =
    disciplineSlug ??
    assignedDisciplinesQuery.primaryRankDisciplineSlug ??
    (rankDisciplines[0]?.slug as RankDisciplineSlug | undefined) ??
    null;

  const activeDiscipline = useMemo(
    () => rankDisciplines.find((item) => item.slug === activeDisciplineSlug) ?? null,
    [activeDisciplineSlug, rankDisciplines],
  );

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

  const disciplineOptions = useMemo(
    () =>
      rankDisciplines.map((discipline) => ({
        value: discipline.slug as RankDisciplineSlug,
        label: discipline.displayName,
      })),
    [rankDisciplines],
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
  const appBarBottomInset = inset.sm;
  const floatingAppBarOffset = 72 + appBarBottomInset;

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['bottom']}
    >
      <AppBar
        title=" "
        showBackButton
        floating
        bottomInset={appBarBottomInset}
        rightElement={
          ranks.length > 0 && !editorOpen ? (
            <AppBarIconButton
              icon="add"
              accessibilityLabel="Add requirement"
              onPress={openCreateEditor}
            />
          ) : undefined
        }
      />

      {assignedDisciplinesQuery.isLoading ? (
        <View
          style={{ flex: 1, padding: inset.lg, paddingTop: appTopInset + floatingAppBarOffset }}
        >
          <StateBlock kind="loading" title="Loading your disciplines" />
        </View>
      ) : !hasRankDiscipline ? (
        <View
          style={{ flex: 1, padding: inset.lg, paddingTop: appTopInset + floatingAppBarOffset }}
        >
          <StateBlock
            kind="empty"
            title="No rank disciplines assigned"
            message="Academy staff must link your coach profile to BJJ or Wrestling before you can manage requirements."
          />
        </View>
      ) : (
        <AppScrollView
          style={styles.flex}
          contentContainerStyle={{
            paddingHorizontal: inset.lg,
            paddingTop: appTopInset + floatingAppBarOffset,
            paddingBottom: inset['3xl'],
            gap: gap.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: gap.md }}>
            <View style={{ gap: gap.sm }}>
              <AcademyEyebrow
                label={
                  activeDiscipline
                    ? `${activeDiscipline.displayName} curriculum`
                    : 'Coach curriculum'
                }
                accent
                showFlag={false}
              />
              <TabHeroTitle
                lines={[[{ text: 'Stripe ' }, { text: 'requirements.', accent: true }]]}
              />
            </View>

            {disciplineOptions.length > 1 && activeDisciplineSlug ? (
              <PillSegmentedTabs
                value={activeDisciplineSlug}
                options={disciplineOptions}
                onValueChange={setDisciplineSlug}
                selectedVariant="accent"
              />
            ) : null}
          </View>

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
                <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
                  {sectionTitle.toUpperCase()}
                </Text>
                <View style={{ gap: gap.sm }}>
                  {items.map((item) => (
                    <CoachCurriculumRequirementCard
                      key={item.id}
                      item={item}
                      onEdit={openEditEditor}
                      onDelete={handleDeleteRequirement}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </AppScrollView>
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
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
});
