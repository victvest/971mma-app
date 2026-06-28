import React, { memo } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { ClassCardTimeOverlay } from '@/features/schedule/components/ClassCardTimeOverlay';
import {
  classStatusMeta,
  formatDisciplineLabel,
  plainClassDescription,
} from '@/features/schedule/utils/classDisplay';
import { useTheme } from '@/shared/theme';
import type { ClassItem } from '@/types/domain';
import { resolveClassImage } from '../utils/classImages';

type ScheduleClassCardProps = {
  item: ClassItem;
  embedded?: boolean;
  isEnrolled?: boolean;
};

function plainDescription(value: string | null): string | null {
  return plainClassDescription(value);
}

function DisciplineDots({ activeCount = 2 }: { activeCount?: number }) {
  const { colors } = useTheme();

  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor:
                index < activeCount ? colors.accent.default : colors.fill.secondary,
            },
          ]}
        />
      ))}
    </View>
  );
}

export const ScheduleClassCard = memo(function ScheduleClassCard({
  item,
  embedded = false,
  isEnrolled = false,
}: ScheduleClassCardProps) {
  const { colors, typography, radius } = useTheme();
  const imageSource = resolveClassImage(item.discipline, item.imageUrl, item.title);
  const description = plainDescription(item.description);
  const spots =
    item.capacity > 0 ? `${item.bookedCount}/${item.capacity} spots` : `${item.bookedCount} booked`;
  const dotCount = item.isAvailable ? 2 : item.isCancelled ? 0 : 1;
  const status = classStatusMeta(item);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.background.elevated,
          borderColor: item.isCancelled ? colors.status.error : colors.border.subtle,
          borderRadius: radius.card,
          marginBottom: embedded ? 0 : 14,
          opacity: item.isCancelled ? 0.72 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.imageWrap,
          {
            borderTopLeftRadius: radius.card,
            borderBottomLeftRadius: radius.card,
          },
        ]}
      >
        <Image source={imageSource} style={styles.image} contentFit="cover" cachePolicy="memory-disk" transition={0} />
        {item.isCancelled ? (
          <View style={[styles.cancelledBadge, { backgroundColor: colors.status.error }]}>
            <Text style={styles.cancelledBadgeText}>CANCELLED</Text>
          </View>
        ) : null}
        <ClassCardTimeOverlay startsAt={item.startsAt} />
      </View>

      <View style={styles.content}>
        <View style={styles.disciplineRow}>
          <Text
            style={[
              styles.discipline,
              { color: item.isCancelled ? colors.status.error : colors.accent.default },
            ]}
          >
            {item.isCancelled ? status.label.toUpperCase() : formatDisciplineLabel(item)}
          </Text>
          {isEnrolled && !item.isCancelled ? (
            <View style={[styles.enrolledBadge, { backgroundColor: colors.status.success + '15', borderColor: colors.status.success + '40' }]}>
              <Text style={[styles.enrolledText, { color: colors.status.success }]}>INCLUDED</Text>
            </View>
          ) : null}
          {!item.isCancelled ? <DisciplineDots activeCount={dotCount} /> : null}
        </View>

        <Text
          numberOfLines={1}
          style={[
            typography.textPresets.subtitle,
            styles.title,
            {
              color: colors.text.primary,
              textDecorationLine: item.isCancelled ? 'line-through' : 'none',
            },
          ]}
        >
          {item.title}
        </Text>

        {description ? (
          <Text
            numberOfLines={2}
            style={[
              styles.description,
              { color: item.isCancelled ? colors.status.error : colors.text.secondary },
            ]}
          >
            {item.isCancelled ? status.detail : description}
          </Text>
        ) : item.isCancelled ? (
          <Text numberOfLines={2} style={[styles.description, { color: colors.status.error }]}>
            {status.detail}
          </Text>
        ) : null}

        <Text numberOfLines={1} style={[styles.footer, { color: colors.text.tertiary }]}>
          {item.isCancelled ? 'Removed from the gym timetable' : `Coach ${item.coachName} · ${spots}`}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    height: 136,
    overflow: 'hidden',
    width: '100%',
    borderWidth: 1,
  },
  imageWrap: {
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    width: 132,
  },
  image: {
    ...StyleSheet.absoluteFill,
    height: undefined,
    width: undefined,
  },
  cancelledBadge: {
    left: 8,
    position: 'absolute',
    top: 8,
    zIndex: 2,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelledBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  disciplineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  discipline: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  enrolledBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  enrolledText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  dot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  footer: {
    fontSize: 12,
    marginTop: 10,
  },
});
