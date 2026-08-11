import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabHeroTitle } from '@/shared/components/brand';
import { AppBottomSheet, AppBottomSheetButton } from '@/shared/components/AppBottomSheet';
import { Chip, PillSegmentedTabs, TextField } from '@/shared/components/ui';
import { triggerLightImpact, triggerSelectionHaptic } from '@/shared/haptics';
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

const REQUIREMENT_TYPES = [
  { value: 'skill' as const, label: 'Skill' },
  { value: 'assessment' as const, label: 'Assessment' },
  { value: 'attendance' as const, label: 'Attendance' },
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

type FieldGroupProps = {
  label: string;
  children: React.ReactNode;
};

function FieldGroup({ label, children }: FieldGroupProps) {
  const { colors, typography, gap } = useTheme();

  return (
    <View style={{ gap: gap.sm }}>
      <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

type StripePickerProps = {
  value: number;
  options: Array<{ value: number; label: string }>;
  onChange: (value: number) => void;
};

function StripePicker({ value, options, onChange }: StripePickerProps) {
  const { colors, typography, gap } = useTheme();

  return (
    <View style={[styles.stripeRow, { gap: gap.sm }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={`Stripe ${option.label}`}
            accessibilityState={{ selected }}
            onPress={() => {
              triggerSelectionHaptic();
              onChange(option.value);
            }}
            style={({ pressed }) => [
              styles.stripeDot,
              {
                backgroundColor: selected ? colors.accent.default : colors.fill.secondary,
                borderColor: selected ? colors.accent.default : colors.border.subtle,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={[
                typography.textPresets.bodyMedium,
                {
                  color: selected ? colors.accent.onAccent : colors.text.secondary,
                  fontWeight: selected ? '700' : '600',
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
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
  const { colors, typography, inset, gap, radius } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [draft, setDraft] = useState<CoachCurriculumRequirementDraft>(() =>
    buildDraft(ranks, initialValue),
  );

  const isEditing = Boolean(initialValue);

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
  const sheetMaxHeight = Math.round(windowHeight * 0.9);

  const handleSave = useCallback(() => {
    if (!canSave || saving) return;
    triggerLightImpact();
    onSave(draft);
  }, [canSave, draft, onSave, saving]);

  const handleDismiss = useCallback(() => {
    if (saving) return;
    onDismiss();
  }, [onDismiss, saving]);

  if (!visible && !ranks.length) return null;

  return (
    <AppBottomSheet
      visible={visible}
      onDismiss={handleDismiss}
      dismissOnBackdropPress={!saving}
      contentStyle={{
        maxHeight: sheetMaxHeight,
        paddingBottom: 0,
        gap: gap.md,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={{ gap: gap.xs }}>
          <TabHeroTitle
            lines={[
              isEditing
                ? [{ text: 'Edit ' }, { text: 'requirement.', accent: true }]
                : [{ text: 'Add ' }, { text: 'requirement.', accent: true }],
            ]}
          />
          <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
            Members see this on their belt path.
          </Text>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={{ gap: gap.lg, paddingBottom: gap.sm }}
        >
          <FieldGroup label="RANK">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.chipRow, { gap: gap.sm }]}
            >
              {rankOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={option.value === draft.rankLevelId}
                  onPress={() => setDraft((current) => ({ ...current, rankLevelId: option.value }))}
                />
              ))}
            </ScrollView>
          </FieldGroup>

          <FieldGroup label="STRIPE">
            <StripePicker
              value={draft.stripe}
              options={stripeOptions}
              onChange={(stripe) => setDraft((current) => ({ ...current, stripe }))}
            />
          </FieldGroup>

          <FieldGroup label="TYPE">
            <PillSegmentedTabs
              value={draft.requirementType}
              options={REQUIREMENT_TYPES}
              onValueChange={(requirementType) =>
                setDraft((current) => ({ ...current, requirementType }))
              }
              selectedVariant="accent"
            />
          </FieldGroup>

          <View style={{ gap: gap.md }}>
            <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
              DETAILS
            </Text>

            <TextField
              label="Title"
              value={draft.title}
              onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
              placeholder="e.g. Chain 3 submissions from guard"
              containerStyle={styles.field}
            />
            <TextField
              label="Description"
              value={draft.description}
              onChangeText={(description) => setDraft((current) => ({ ...current, description }))}
              multiline
              placeholder="What the member needs to demonstrate"
              containerStyle={styles.field}
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
                containerStyle={styles.field}
              />
            ) : null}

            <TextField
              label="Sort order"
              value={draft.sortOrder}
              onChangeText={(sortOrder) => setDraft((current) => ({ ...current, sortOrder }))}
              keyboardType="number-pad"
              hint="Lower numbers appear first within the same stripe."
              containerStyle={styles.field}
            />
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border.subtle,
              paddingTop: inset.md,
              paddingBottom: safeInsets.bottom + inset.lg,
              gap: gap.xs,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Save changes' : 'Add requirement'}
            accessibilityState={{ disabled: !canSave || saving }}
            disabled={!canSave || saving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.accent.default,
                borderRadius: radius.pill,
                opacity: !canSave || saving ? 0.45 : pressed ? 0.88 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.accent.onAccent} />
            ) : (
              <Text style={[typography.textPresets.button, { color: colors.accent.onAccent }]}>
                {isEditing ? 'Save changes' : 'Add requirement'}
              </Text>
            )}
          </Pressable>

          <AppBottomSheetButton label="Not now" variant="secondary" onPress={handleDismiss} />
        </View>
      </KeyboardAvoidingView>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: {
    flexShrink: 1,
    minHeight: 0,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  chipRow: {
    flexDirection: 'row',
    paddingRight: 4,
  },
  stripeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stripeDot: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  field: {
    marginBottom: 0,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
  },
});
