import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { StateBlock } from '@/shared/components/StateBlock';
import { AppBar, TextField } from '@/shared/components/ui';
import { AcademyEyebrow } from '@/shared/components/brand';
import { CommunityMemberPicker } from '@/features/communities/components/CommunityMemberPicker';
import {
  useCoachGroupDisciplines,
  useCreateCommunityGroup,
} from '@/features/communities/hooks/useCommunities';
import { useMyCoachRecord } from '@/features/coach/hooks/useMyCoachRecord';
import { toast } from '@/shared/components/Toast';
import { triggerLightImpact, triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { CommunityGroupDiscipline, CommunityGroupMemberCandidate } from '@/types/domain';

type WizardStep = 0 | 1 | 2 | 3;

const STEPS = [
  { label: 'Discipline', icon: 'school-outline' },
  { label: 'Details', icon: 'create-outline' },
  { label: 'Members', icon: 'people-outline' },
  { label: 'Review', icon: 'checkmark-circle-outline' },
] as const;

function StepProgress({ step }: { step: WizardStep }) {
  const { colors, typography, gap, radius } = useTheme();

  return (
    <View style={[styles.progressWrap, { gap: gap.xs }]}>
      {STEPS.map((item, index) => {
        const active = index === step;
        const done = index < step;
        const tone = active || done ? colors.accent.default : colors.text.tertiary;

        return (
          <View key={item.label} style={styles.progressItem}>
            <View
              style={[
                styles.progressDot,
                {
                  backgroundColor: active || done ? colors.accent.default : colors.fill.secondary,
                  borderColor: active || done ? colors.accent.default : colors.border.subtle,
                  borderRadius: radius.pill,
                },
              ]}
            >
              <Ionicons
                name={done ? 'checkmark' : item.icon}
                size={14}
                color={active || done ? colors.accent.onAccent : colors.text.tertiary}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[
                typography.textPresets.captionMedium,
                styles.progressLabel,
                { color: tone },
              ]}
            >
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  body: string;
};

function SectionHeader({ eyebrow, title, body }: SectionHeaderProps) {
  const { colors, typography, gap } = useTheme();

  return (
    <View style={{ gap: gap.sm }}>
      <AcademyEyebrow label={eyebrow} accent />
      <Text style={[typography.textPresets.heading, styles.stepTitle, { color: colors.text.primary }]}>
        {title}
      </Text>
      <Text style={[typography.textPresets.bodyMedium, styles.stepBody, { color: colors.text.secondary }]}>
        {body}
      </Text>
    </View>
  );
}

type DisciplineCardProps = {
  discipline: CommunityGroupDiscipline;
  selected: boolean;
  onPress: () => void;
};

function DisciplineCard({ discipline, selected, onPress }: DisciplineCardProps) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.choiceCard,
        {
          backgroundColor: selected ? colors.accent.subtle : colors.surface.secondary,
          borderColor: selected ? colors.accent.default : colors.border.subtle,
          borderRadius: radius.card,
          borderWidth: selected ? 1.5 : layout.borderWidth,
          gap: gap.md,
          opacity: pressed ? 0.86 : 1,
          padding: inset.md,
        },
      ]}
    >
      <View
        style={[
          styles.choiceIcon,
          {
            backgroundColor: selected ? colors.accent.default : colors.surface.primary,
            borderRadius: radius.pill,
          },
        ]}
      >
        <Ionicons
          name="school-outline"
          size={20}
          color={selected ? colors.accent.onAccent : colors.accent.default}
        />
      </View>
      <View style={styles.choiceCopy}>
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
          {discipline.name}
        </Text>
        <Text style={[typography.textPresets.caption, { color: colors.text.secondary }]}>
          {discipline.slug.toUpperCase()}
        </Text>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? colors.accent.default : colors.text.tertiary}
      />
    </Pressable>
  );
}

type ReviewRowProps = {
  label: string;
  value: string;
};

function ReviewRow({ label, value }: ReviewRowProps) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.reviewRow, { borderTopColor: colors.border.subtle }]}>
      <Text style={[typography.textPresets.captionMedium, { color: colors.text.tertiary }]}>
        {label}
      </Text>
      <Text
        numberOfLines={2}
        style={[typography.textPresets.bodyStrong, styles.reviewValue, { color: colors.text.primary }]}
      >
        {value}
      </Text>
    </View>
  );
}

export function CommunityGroupWizardScreen() {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const router = useRouter();
  const { coach } = useMyCoachRecord();
  const disciplinesQuery = useCoachGroupDisciplines(true);
  const createMutation = useCreateCommunityGroup(coach?.id ?? '');
  const disciplines = disciplinesQuery.data ?? [];
  const [step, setStep] = useState<WizardStep>(0);
  const [disciplineId, setDisciplineId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<CommunityGroupMemberCandidate[]>([]);

  useEffect(() => {
    if (!disciplineId && disciplines[0]?.id) {
      setDisciplineId(disciplines[0].id);
    }
  }, [disciplineId, disciplines]);

  const selectedDiscipline = useMemo(
    () => disciplines.find((item) => item.id === disciplineId) ?? disciplines[0] ?? null,
    [disciplineId, disciplines],
  );

  const canAdvance =
    (step === 0 && Boolean(selectedDiscipline)) ||
    (step === 1 && Boolean(title.trim())) ||
    (step === 2 && selectedMembers.length > 0) ||
    step === 3;
  const canCreate = Boolean(coach?.id && selectedDiscipline?.id && title.trim() && canAdvance);

  const goNext = () => {
    if (!canAdvance) return;
    triggerLightImpact();
    setStep((current) => Math.min(current + 1, 3) as WizardStep);
  };

  const goBack = () => {
    triggerSelectionHaptic();
    setStep((current) => Math.max(current - 1, 0) as WizardStep);
  };

  const handleCreate = () => {
    if (!coach?.id || !selectedDiscipline?.id || !title.trim() || createMutation.isPending) return;
    if (selectedMembers.length === 0) return;

    triggerLightImpact();
    createMutation.mutate(
      {
        disciplineId: selectedDiscipline.id,
        title: title.trim(),
        description: description.trim() || null,
        memberIds: selectedMembers.map((member) => member.id),
      },
      {
        onSuccess: (channel) => {
          toast.success('Group created', channel.title);
          router.replace(`/communities/${channel.id}`);
        },
        onError: () => {
          toast.error('Could not create group', 'Please check the details and try again.');
        },
      },
    );
  };

  const renderStep = () => {
    if (disciplinesQuery.isLoading) {
      return <StateBlock kind="loading" title="Loading disciplines" />;
    }

    if (disciplinesQuery.isError || !coach?.id) {
      return (
        <StateBlock
          kind="error"
          title="Could not load group setup"
          actionLabel="Retry"
          onAction={() => disciplinesQuery.refetch()}
        />
      );
    }

    if (disciplines.length === 0) {
      return (
        <StateBlock
          kind="empty"
          title="No disciplines linked"
          message="Ask academy staff to link your coach profile to a discipline."
        />
      );
    }

    if (step === 0) {
      return (
        <View style={{ gap: gap.lg }}>
          <SectionHeader
            eyebrow="Step 1 · Discipline"
            title="Choose the community."
            body="The group will live inside this discipline for your members."
          />
          <View style={{ gap: gap.sm }}>
            {disciplines.map((discipline) => (
              <DisciplineCard
                key={discipline.id}
                discipline={discipline}
                selected={discipline.id === selectedDiscipline?.id}
                onPress={() => setDisciplineId(discipline.id)}
              />
            ))}
          </View>
        </View>
      );
    }

    if (step === 1) {
      return (
        <View style={{ gap: gap.lg }}>
          <SectionHeader
            eyebrow="Step 2 · Details"
            title="Name the room."
            body="Use the name members will recognize on the schedule or in class."
          />
          <View style={{ gap: gap.md }}>
            <TextField
              label="Group name"
              value={title}
              onChangeText={setTitle}
              placeholder="Session 1 competition team"
              maxLength={80}
              containerStyle={styles.field}
            />
            <TextField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional"
              maxLength={240}
              multiline
              containerStyle={styles.field}
              style={styles.descriptionInput}
            />
          </View>
          <View
            style={[
              styles.previewPanel,
              {
                backgroundColor: colors.surface.secondary,
                borderColor: colors.border.subtle,
                borderRadius: radius.card,
                borderWidth: layout.borderWidth,
                padding: inset.md,
              },
            ]}
          >
            <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
              PREVIEW
            </Text>
            <Text
              numberOfLines={1}
              style={[typography.textPresets.subtitle, { color: colors.text.primary }]}
            >
              {title.trim() || 'Group name'}
            </Text>
            <Text
              numberOfLines={2}
              style={[typography.textPresets.footnote, { color: colors.text.secondary }]}
            >
              {selectedDiscipline?.name ?? 'Discipline'} · {description.trim() || 'No description'}
            </Text>
          </View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={{ gap: gap.lg }}>
          <SectionHeader
            eyebrow="Step 3 · Members"
            title="Add your members."
            body="Groups are private — only the members you add here can see and post in this group."
          />
          <View style={{ gap: gap.sm }}>
            <View style={styles.inlineTitle}>
              <Ionicons name="people-outline" size={17} color={colors.accent.default} />
              <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
                Add members before review
              </Text>
            </View>
            <CommunityMemberPicker
              coachId={coach.id}
              selectedMembers={selectedMembers}
              onSelectedMembersChange={setSelectedMembers}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={{ gap: gap.lg }}>
        <SectionHeader
          eyebrow="Step 4 · Review"
          title="Ready to create."
          body="Check the setup before members see the group."
        />
        <View
          style={[
            styles.reviewPanel,
            {
              backgroundColor: colors.surface.secondary,
              borderColor: colors.border.subtle,
              borderRadius: radius.card,
              borderWidth: layout.borderWidth,
              padding: inset.md,
            },
          ]}
        >
          <View style={styles.reviewHeroRow}>
            <View
              style={[
                styles.reviewIcon,
                { backgroundColor: colors.accent.default, borderRadius: radius.pill },
              ]}
            >
              <Ionicons name="chatbubbles-outline" size={24} color={colors.accent.onAccent} />
            </View>
            <View style={styles.reviewTitleCopy}>
              <Text
                numberOfLines={2}
                style={[typography.textPresets.subtitle, { color: colors.text.primary }]}
              >
                {title.trim()}
              </Text>
              <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
                Private group
              </Text>
            </View>
          </View>
          <ReviewRow label="Discipline" value={selectedDiscipline?.name ?? 'Not selected'} />
          <ReviewRow label="Description" value={description.trim() || 'No description'} />
          <ReviewRow label="Members" value={`${selectedMembers.length} selected`} />
          {selectedMembers.length > 0 ? (
            <View style={[styles.avatarRail, { gap: gap.xs }]}>
              {selectedMembers.slice(0, 6).map((member) => (
                <MemberAvatar
                  key={member.id}
                  name={member.fullName}
                  avatarUrl={member.avatarUrl}
                  size={34}
                  backgroundColor={colors.accent.default}
                  textColor={colors.text.inverse}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const primaryLabel = step === 3 ? 'Create group' : 'Continue';
  const primaryDisabled =
    !canAdvance ||
    createMutation.isPending ||
    (step === 3 && !canCreate);

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Create group" showBackButton fallbackHref="/(coach)/communities" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: gap.xl,
            paddingHorizontal: inset.lg,
            paddingTop: inset.lg,
            paddingBottom: inset.xl,
          }}
        >
          <StepProgress step={step} />
          {renderStep()}
        </ScrollView>
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background.primary,
              borderTopColor: colors.border.subtle,
              gap: gap.sm,
              paddingHorizontal: inset.lg,
              paddingTop: inset.md,
              paddingBottom: inset.lg,
            },
          ]}
        >
          {step > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={goBack}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  borderColor: colors.border.default,
                  borderRadius: radius.pill,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text style={[typography.textPresets.button, { color: colors.text.primary }]}>
                Back
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
            accessibilityState={{ disabled: primaryDisabled }}
            disabled={primaryDisabled}
            onPress={step === 3 ? handleCreate : goNext}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.accent.default,
                borderRadius: radius.pill,
                flex: 1,
                opacity: primaryDisabled ? 0.45 : pressed ? 0.88 : 1,
              },
            ]}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color={colors.accent.onAccent} />
            ) : (
              <Text style={[typography.textPresets.button, { color: colors.accent.onAccent }]}>
                {primaryLabel}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  progressWrap: {
    flexDirection: 'row',
  },
  progressItem: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  progressDot: {
    alignItems: 'center',
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  progressLabel: {
    maxWidth: 82,
    textAlign: 'center',
  },
  stepTitle: {
    fontSize: 30,
    letterSpacing: 0,
    lineHeight: 34,
  },
  stepBody: {
    maxWidth: 360,
  },
  choiceCard: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  choiceIcon: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  choiceCopy: {
    flex: 1,
    minWidth: 0,
  },
  field: {
    marginBottom: 0,
  },
  descriptionInput: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  previewPanel: {
    gap: 8,
  },
  inlineTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  reviewPanel: {
    gap: 14,
  },
  reviewHeroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  reviewIcon: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  reviewTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  reviewRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingTop: 12,
  },
  reviewValue: {
    textAlign: 'left',
  },
  avatarRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
  },
  secondaryButton: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 104,
    paddingHorizontal: 20,
  },
});
