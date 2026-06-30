import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BrandedButton, Chip, TextField } from '@/shared/components/ui';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { CoachCurriculumRank, CoachCurriculumRequirement } from '@/types/domain';

type RequirementType = CoachCurriculumRequirement['requirementType'];

export type CoachCurriculumRequirementDraft = {
  requirementId?: string | null;
  rankLevelId: string;
  stripe: number;
  title: string;
  description: string;
  requirementType: RequirementType;
  attendanceTarget: string;
  sortOrder: string;
};

type Props = {
  visible: boolean;
  ranks: CoachCurriculumRank[];
  initialValue?: CoachCurriculumRequirement | null;
  saving?: boolean;
  onDismiss: () => void;
  onSave: (draft: CoachCurriculumRequirementDraft) => void;
};

const REQUIREMENT_TYPES: Array<{ value: RequirementType; label: string }> = [
  { value: 'skill', label: 'Skill' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'attendance', label: 'Attendance' },
];

function buildDraft(
  ranks: CoachCurriculumRank[],
  initialValue?: CoachCurriculumRequirement | null,
): CoachCurriculumRequirementDraft {
  const defaultRankId = initialValue?.rankLevelId ?? ranks[0]?.id ?? '';

  return {
    requirementId: initialValue?.id ?? null,
    rankLevelId: defaultRankId,
    stripe: initialValue?.stripe ?? 1,
    title: initialValue?.title ?? '',
    description: initialValue?.description ?? '',
    requirementType: initialValue?.requirementType ?? 'skill',
    attendanceTarget:
      initialValue?.attendanceTarget != null ? String(initialValue.attendanceTarget) : '',
    sortOrder: initialValue?.sortOrder != null ? String(initialValue.sortOrder) : '0',
  };
}

type SelectorSectionProps<T extends string | number> = {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
};

function SelectorSection<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: SelectorSectionProps<T>) {
  const { colors, typography, gap } = useTheme();

  return (
    <View style={{ gap: gap.sm }}>
      <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.selectorRow, { gap: gap.sm }]}
      >
        {options.map((option) => (
          <Chip
            key={String(option.value)}
            label={option.label}
            active={option.value === value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function CoachCurriculumRequirementEditor({
  visible,
  ranks,
  initialValue,
  saving = false,
  onDismiss,
  onSave,
}: Props) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const [draft, setDraft] = useState<CoachCurriculumRequirementDraft>(() =>
    buildDraft(ranks, initialValue),
  );

  useEffect(() => {
    if (!visible) return;
    setDraft(buildDraft(ranks, initialValue));
  }, [initialValue, ranks, visible]);

  const selectedRank = useMemo(
    () => ranks.find((rank) => rank.id === draft.rankLevelId) ?? ranks[0] ?? null,
    [draft.rankLevelId, ranks],
  );

  const rankOptions = useMemo(
    () => ranks.map((rank) => ({ value: rank.id, label: rank.name })),
    [ranks],
  );

  const stripeOptions = useMemo(() => {
    const max = selectedRank?.stripes ?? 4;
    return Array.from({ length: max + 1 }, (_, index) => ({
      value: index,
      label: String(index),
    }));
  }, [selectedRank?.stripes]);

  const canSave = draft.rankLevelId.length > 0 && draft.title.trim().length > 0;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onSave(draft);
  }, [canSave, draft, onSave]);

  const fieldContainerStyle = { marginBottom: 0 };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <View style={[styles.root, { backgroundColor: colors.background.primary }]}>
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.border.subtle,
              paddingHorizontal: inset.lg,
              paddingTop: safeInsets.top > 0 ? inset.sm : inset.lg,
              paddingBottom: inset.md,
            },
          ]}
        >
          <View style={styles.headerCopy}>
            <Text style={[typography.textPresets.title, { color: colors.text.primary, fontSize: 22 }]}>
              {initialValue ? 'Edit requirement' : 'Add requirement'}
            </Text>
            <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
              Members see these on their belt path for your discipline.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close requirement editor"
            onPress={() => {
              triggerSelectionHaptic();
              onDismiss();
            }}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: colors.fill.secondary,
                borderRadius: radius.pill,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="close" size={18} color={colors.text.primary} />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: gap.lg,
            padding: inset.lg,
            paddingBottom: inset.md,
          }}
        >
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surface.secondary,
                borderColor: colors.border.subtle,
                borderRadius: radius.card,
                borderWidth: layout.borderWidth,
                gap: gap.lg,
                padding: inset.md,
              },
            ]}
          >
            <Text style={[typography.textPresets.captionMedium, { color: colors.text.tertiary }]}>
              PLACEMENT
            </Text>

            <SelectorSection
              label="Rank"
              options={rankOptions}
              value={draft.rankLevelId}
              onChange={(rankLevelId) => setDraft((current) => ({ ...current, rankLevelId }))}
            />

            <SelectorSection
              label="Stripe"
              options={stripeOptions}
              value={draft.stripe}
              onChange={(stripe) => setDraft((current) => ({ ...current, stripe }))}
            />

            <SelectorSection
              label="Type"
              options={REQUIREMENT_TYPES}
              value={draft.requirementType}
              onChange={(requirementType) => setDraft((current) => ({ ...current, requirementType }))}
            />
          </View>

          <View style={{ gap: gap.md }}>
            <Text style={[typography.textPresets.captionMedium, { color: colors.text.tertiary }]}>
              DETAILS
            </Text>

            <TextField
              label="Title"
              value={draft.title}
              onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
              placeholder="e.g. Chain 3 submissions from guard"
              containerStyle={fieldContainerStyle}
            />
            <TextField
              label="Description (optional)"
              value={draft.description}
              onChangeText={(description) => setDraft((current) => ({ ...current, description }))}
              multiline
              placeholder="What the member needs to demonstrate"
              containerStyle={fieldContainerStyle}
            />

            {draft.requirementType === 'attendance' ? (
              <TextField
                label="Classes required"
                value={draft.attendanceTarget}
                onChangeText={(attendanceTarget) =>
                  setDraft((current) => ({ ...current, attendanceTarget }))
                }
                keyboardType="number-pad"
                placeholder="40"
                containerStyle={fieldContainerStyle}
              />
            ) : null}

            <TextField
              label="Sort order"
              value={draft.sortOrder}
              onChangeText={(sortOrder) => setDraft((current) => ({ ...current, sortOrder }))}
              keyboardType="number-pad"
              hint="Lower numbers appear first within the same stripe."
              containerStyle={fieldContainerStyle}
            />
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border.subtle,
              paddingHorizontal: inset.lg,
              paddingTop: inset.md,
              paddingBottom: safeInsets.bottom + inset.md,
              backgroundColor: colors.background.primary,
            },
          ]}
        >
          <BrandedButton
            label={initialValue ? 'Save changes' : 'Add requirement'}
            onPress={handleSave}
            loading={saving}
            disabled={!canSave || saving}
            full
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  closeButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sectionCard: {},
  selectorRow: {
    flexDirection: 'row',
    paddingRight: 4,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
