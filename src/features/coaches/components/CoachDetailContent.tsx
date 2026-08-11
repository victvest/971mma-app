import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SharedValue } from 'react-native-reanimated';
import { CoachClassRow } from '@/features/coaches/components/CoachClassRow';
import { CoachDetailStats } from '@/features/coaches/components/CoachDetailStats';
import {
  getCoachRankLabel,
  getCoachSpecialtyLabel,
} from '@/features/coaches/components/CoachVisuals';
import { COACH_SHEET_OVERLAP } from '@/features/coaches/utils/coachDetailConstants';
import { DetailRevealSection, DetailSectionCard } from '@/shared/components/detail';
import { UaeFlagMark } from '@/shared/components/brand';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import { toUserFacingErrorMessage } from '@/lib/userFacingError';
import type { ClassItem, CoachItem } from '@/types/domain';

type Props = {
  coach: CoachItem;
  classes: ClassItem[];
  classCount: number;
  classesLoading: boolean;
  classesError: unknown;
  onRetryClasses: () => void;
  onOpenClass: (id: string) => void;
  onOpenSchedule: () => void;
  scrollY: SharedValue<number>;
  screenHeight: number;
  contentTopOffset: number;
};

function SectionHeader({
  title,
  linkLabel,
  onPressLink,
}: {
  title: string;
  linkLabel?: string;
  onPressLink?: () => void;
}) {
  const { colors, typography, radius, gap } = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionHeaderLeft, { gap: gap.sm }]}>
        <View
          style={[
            styles.accentDot,
            { backgroundColor: colors.accent.default, borderRadius: radius.pill },
          ]}
        />
        <Text style={[typography.textPresets.label, { color: colors.text.tertiary }]}>{title}</Text>
      </View>
      {linkLabel && onPressLink ? (
        <Pressable
          onPress={onPressLink}
          accessibilityRole="button"
          style={[styles.link, { gap: gap.xs }]}
        >
          <Text style={[typography.textPresets.buttonSmall, { color: colors.accent.pressed }]}>
            {linkLabel}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={typography.fontSize.md}
            color={colors.accent.pressed}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function BulletRows({ items }: { items: string[] }) {
  const { colors, typography, gap } = useTheme();

  return (
    <View style={{ gap: gap.sm }}>
      {items.map((item) => (
        <View key={item} style={[styles.bulletRow, { gap: gap.sm }]}>
          <View
            style={[styles.bulletDot, { backgroundColor: colors.accent.default }]}
          />
          <Text style={[typography.textPresets.body, styles.bulletText, { color: colors.text.primary }]}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function CoachDetailContent({
  coach,
  classes,
  classCount,
  classesLoading,
  classesError,
  onRetryClasses,
  onOpenClass,
  onOpenSchedule,
  scrollY,
  screenHeight,
  contentTopOffset,
}: Props) {
  const { colors, typography, inset, radius, gap } = useTheme();
  const bio = coach.bio?.trim();

  const sections: ReactNode[] = [
    <CoachDetailStats
      key="stats"
      coach={coach}
      classCount={classCount}
      classesReady={!classesLoading}
    />,
  ];

  sections.push(
    <DetailSectionCard key="lineage" title="Belt & lineage" accent="brand">
      <View style={[styles.lineageRow, { gap: gap.md }]}>
        <UaeFlagMark />
        <View style={styles.lineageText}>
          <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
            {getCoachRankLabel(coach)}
          </Text>
          <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
            Lineage · 971 MMA
          </Text>
        </View>
      </View>
    </DetailSectionCard>,

    <View key="about" style={{ gap: gap.md }}>
      <SectionHeader title={`About ${firstName(coach.name)}`} />
      <Text style={[typography.textPresets.body, styles.bio, { color: colors.text.primary }]}>
        {bio ||
          `${coach.name} leads sessions at 971 MMA across ${getCoachSpecialtyLabel(coach)}. Full profile copy is pending from the academy — class schedule and rank details are available now.`}
      </Text>
    </View>,
  );

  if (coach.statusAchievements.length > 0) {
    sections.push(
      <DetailSectionCard key="achievements" title="Status & achievements" accent="brand">
        <BulletRows items={coach.statusAchievements} />
      </DetailSectionCard>,
    );
  }

  if (coach.experienceHighlights.length > 0) {
    sections.push(
      <DetailSectionCard key="experience" title="Experience" accent="brand">
        <BulletRows items={coach.experienceHighlights} />
      </DetailSectionCard>,
    );
  }

  if (coach.coachingStyle.length > 0) {
    sections.push(
      <DetailSectionCard key="style" title="Coaching style" accent="brand">
        <BulletRows items={coach.coachingStyle} />
      </DetailSectionCard>,
    );
  } else if (coach.coachingPhilosophy?.trim()) {
    sections.push(
      <DetailSectionCard key="philosophy" title="Coaching philosophy" accent="brand">
        <Text style={[typography.textPresets.body, styles.bio, { color: colors.text.primary }]}>
          {coach.coachingPhilosophy.trim()}
        </Text>
      </DetailSectionCard>,
    );
  }

  const scheduleLink = (
    <Pressable
      onPress={onOpenSchedule}
      accessibilityRole="button"
      style={[styles.link, { gap: gap.xs }]}
    >
      <Text style={[typography.textPresets.buttonSmall, { color: colors.accent.pressed }]}>
        Schedule
      </Text>
      <Ionicons name="arrow-forward" size={typography.fontSize.md} color={colors.accent.pressed} />
    </Pressable>
  );

  sections.push(
    <DetailSectionCard key="classes" title="Weekly classes" trailing={scheduleLink}>
      {classesLoading ? (
        <StateBlock kind="loading" title="Loading classes" />
      ) : classesError ? (
        <StateBlock
          kind="error"
          title="Could not load classes"
          message={toUserFacingErrorMessage(classesError, { fallback: 'Please try again.' })}
          actionLabel="Retry"
          onAction={onRetryClasses}
        />
      ) : classes.length === 0 ? (
        <StateBlock
          kind="empty"
          title="No classes scheduled"
          message="No upcoming classes matched to this coach."
        />
      ) : (
        <View style={{ gap: gap.sm }}>
          {classes.map((item) => (
            <CoachClassRow key={item.id} item={item} onPress={onOpenClass} />
          ))}
        </View>
      )}
    </DetailSectionCard>,
  );

  return (
    <View
      style={[
        styles.sheet,
        {
          marginTop: -COACH_SHEET_OVERLAP,
          borderTopLeftRadius: radius.modal,
          borderTopRightRadius: radius.modal,
          backgroundColor: colors.background.primary,
          paddingHorizontal: inset.lg,
          paddingTop: inset.xl,
          gap: gap.xl,
        },
      ]}
    >
      <View
        style={[
          styles.grabber,
          { backgroundColor: colors.border.strong, borderRadius: radius.pill },
        ]}
      />

      {sections.map((section, index) => (
        <DetailRevealSection
          key={(section as { key?: string }).key ?? index}
          index={index}
          scrollY={scrollY}
          screenHeight={screenHeight}
          contentTopOffset={contentTopOffset}
          strength={1.15}
        >
          {section}
        </DetailRevealSection>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
  },
  grabber: {
    alignSelf: 'center',
    height: 4,
    marginBottom: 4,
    opacity: 0.6,
    width: 40,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  accentDot: {
    height: 8,
    width: 8,
  },
  link: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  lineageRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  lineageText: {
    flex: 1,
    minWidth: 0,
  },
  bio: {
    lineHeight: 26,
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  bulletDot: {
    borderRadius: 999,
    height: 6,
    marginTop: 8,
    width: 6,
  },
  bulletText: {
    flex: 1,
    lineHeight: 22,
  },
});
