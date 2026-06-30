import React, { useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, Linking, useWindowDimensions, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AlertTriangle, Calendar, MapPin } from 'lucide-react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';

import { isClassLiveNow, isClassUpcoming, GYM_TIME_ZONE, formatGymTime12h } from '@/core/time/gymTime';
import type { ClassItem, CoachItem } from '@/types/domain';
import {
  CLASS_REMINDER_BAR_HEIGHT,
  ClassReminderSubscribeBar,
} from '@/features/schedule/components/ClassReminderSubscribeBar';
import { getCoachImageSource, getCoachRatingLabel } from '@/features/coaches/components/CoachVisuals';
import { GlassNavChrome, GlassSurface } from '@/features/home/components/navigation/GlassNavChrome';
import { NAV_CHROME, UAE } from '@/features/home/components/navigation/uaeChrome';
import { resolveClassImage } from '@/features/schedule/utils/classImages';
import { formatDisciplineLabel, plainClassDescription } from '@/features/schedule/utils/classDisplay';
import { UaeBrandAmbientGlow } from '@/shared/components/brand';
import { triggerLightImpact, triggerMediumImpact } from '@/shared/haptics';
import { useAuthStore } from '@/stores/useAuthStore';

type Props = {
  item: ClassItem;
  coach: CoachItem | null;
  coachLoading: boolean;
  canOpenCoach: boolean;
  fromSchedule?: boolean;
  onOpenCoach: () => void;
  onBackToSchedule: () => void;
  onShowQrPass?: () => void;
};

export function ClassDetailView({
  item,
  coach,
  coachLoading,
  canOpenCoach,
  fromSchedule = false,
  onOpenCoach,
}: Props) {
  const router = useRouter();
  const safeInsets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const scrollY = useSharedValue(0);

  const heroHeight = Math.min(height * 0.45, 360);

  const imageSource = resolveClassImage(item.discipline, item.imageUrl);
  const live = isClassLiveNow(item.startsAt, item.durationMinutes);

  const openSpots = item.capacity > 0 ? Math.max(item.capacity - item.bookedCount, 0) : null;

  const coachDisplayName = useMemo(() => {
    const name = coach?.name ?? item.coachName;
    return name.trim().toLowerCase().startsWith('coach') ? name : `Coach ${name}`;
  }, [coach?.name, item.coachName]);

  // Only show real bio — no generated fallback text
  const instructorBio = coach?.bio?.trim() ?? null;

  const weekdayLong = useMemo(() => {
    try {
      const date = new Date(item.startsAt);
      return new Intl.DateTimeFormat('en-US', {
        timeZone: GYM_TIME_ZONE,
        weekday: 'long',
      }).format(date);
    } catch (e) {
      return 'Today';
    }
  }, [item.startsAt]);

  const timeStr = useMemo(() => {
    try {
      return formatGymTime12h(item.startsAt);
    } catch (e) {
      return '7:00 PM';
    }
  }, [item.startsAt]);

  const calendarHeadline = `${weekdayLong} • ${timeStr} • ${item.durationMinutes} min`;

  const classDescription = useMemo(() => plainClassDescription(item.description), [item.description]);
  const disciplineLabel = useMemo(() => formatDisciplineLabel(item), [item]);

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const heroImageStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-100, 0, heroHeight],
          [-30, 0, heroHeight * 0.25],
          Extrapolation.CLAMP
        ),
      },
      {
        scale: interpolate(scrollY.value, [-100, 0, heroHeight], [1.15, 1.0, 1.1], Extrapolation.CLAMP),
      },
    ],
  }));

  // Capacity calculations
  const isFull = openSpots === 0;
  const isAlmostFull = openSpots !== null && openSpots > 0 && openSpots <= 5;
  const statusColor = isFull || isAlmostFull ? '#D71920' : '#007A33';
  const spotsRemainingLabel = openSpots === null
    ? 'Open floor session'
    : openSpots === 0
      ? 'No spots remaining'
      : `${openSpots} spot${openSpots === 1 ? '' : 's'} remaining`;

  const coachRoleLabel = useMemo(() => {
    if (coachLoading) return 'Loading profile…';
    const specialty = (coach?.specialty?.split(',')[0] ?? item.discipline) || 'MMA';
    const rating =
      coach?.rating !== null && coach?.rating !== undefined ? ` · ${getCoachRatingLabel(coach)}★` : '';
    if (coach?.isHeadCoach) {
      return `Head ${specialty} Instructor${rating}`;
    }
    return `${specialty} Instructor${rating}`;
  }, [coach, coach?.isHeadCoach, coach?.rating, coach?.specialty, coachLoading, item.discipline]);

  const capacityTotal = item.capacity > 0 ? item.capacity : 30;
  const statusHeadline = isFull
    ? 'Full'
    : isAlmostFull
      ? 'Almost Full'
      : 'Open';
  const showStatusWarning = isFull || isAlmostFull;

  const openLocation = () => {
    triggerLightImpact();
    const query = encodeURIComponent('971 MMA Headquarters, Dubai');
    void Linking.openURL(`https://maps.apple.com/?q=${query}`);
  };

  const shareClass = useCallback(async () => {
    triggerMediumImpact();
    try {
      await Share.share({
        message: `${item.title}\n${calendarHeadline}\n${disciplineLabel}\n971 MMA — Dubai`,
      });
    } catch {
      // User dismissed the share sheet.
    }
  }, [calendarHeadline, disciplineLabel, item.title]);

  const canSubscribeToClass = !item.isCancelled && isClassUpcoming(item.startsAt);
  const userId = useAuthStore((state) => state.user?.id);
  const showSubscribeBar = Boolean(userId) && canSubscribeToClass;

  const capacityFraction = item.bookedCount / capacityTotal;
  const progressPercentage = Math.min(Math.max(capacityFraction, 0), 1) * 100;

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          showSubscribeBar && { paddingBottom: safeInsets.bottom + CLASS_REMINDER_BAR_HEIGHT },
        ]}
      >
        {/* Hero Image */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <Animated.View style={[StyleSheet.absoluteFill, heroImageStyle]}>
            <Image source={imageSource} contentFit="cover" style={StyleSheet.absoluteFill} transition={200} />
          </Animated.View>
          <UaeBrandAmbientGlow variant="photo-hero" topInset={safeInsets.top} />
        </View>

        {/* Floating title card overlapping hero */}
        <View style={styles.floatingCardWrap}>
          <View style={styles.floatingCard}>
            <View style={styles.floatingCardContent}>
            <View style={styles.tagRow}>
              {item.discipline ? (
                <View style={styles.disciplineTag}>
                  <Text style={styles.disciplineTagText}>
                    {item.discipline.trim().toUpperCase()}
                  </Text>
                </View>
              ) : null}
              {item.level ? (
                <View style={styles.levelTag}>
                  <Text style={styles.levelTagText}>
                    {item.level.trim().toUpperCase()}
                  </Text>
                </View>
              ) : null}
              {live && !item.isCancelled ? (
                <View style={styles.liveTag}>
                  <Text style={styles.liveTagText}>LIVE</Text>
                </View>
              ) : item.isCancelled ? (
                <View style={styles.cancelledTag}>
                  <Text style={styles.liveTagText}>CANCELLED</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.title}>{item.title}</Text>

            <View style={styles.calendarRow}>
              <Calendar size={16} color="#007A33" style={styles.calendarIcon} />
              <Text style={styles.calendarText}>{calendarHeadline}</Text>
            </View>

            <Text style={styles.disciplineLine}>{disciplineLabel}</Text>
            </View>
          </View>
        </View>

        {/* Detail cards */}
        <View style={styles.infoContainer}>
          {classDescription ? (
            <GlassSurface
              borderRadius={32}
              style={styles.detailCardGlass}
              contentStyle={[styles.detailCardContent, styles.detailCardCompact]}
            >
              <Text style={styles.sectionLabel}>About this class</Text>
              <Text style={styles.descriptionText}>{classDescription}</Text>
            </GlassSurface>
          ) : null}

          {/* Instructor profile card */}
          <Pressable
            onPress={canOpenCoach ? onOpenCoach : undefined}
            disabled={!canOpenCoach}
            style={({ pressed }) => [pressed && canOpenCoach && styles.detailCardPressed]}
            accessibilityRole={canOpenCoach ? 'button' : undefined}
            accessibilityLabel={canOpenCoach ? `View ${coachDisplayName} profile` : coachDisplayName}
          >
            <GlassSurface
              borderRadius={32}
              style={styles.detailCardGlass}
              contentStyle={styles.detailCardContent}
            >
              <Image
                source={getCoachImageSource(coach)}
                contentFit="cover"
                cachePolicy="memory-disk"
                style={styles.instructorAvatarLarge}
              />
              <Text style={styles.instructorNameCentered}>{coachDisplayName}</Text>
              <Text style={styles.instructorRoleCentered}>{coachRoleLabel}</Text>
              {instructorBio ? (
                <Text style={styles.instructorBioCentered}>{instructorBio}</Text>
              ) : null}
            </GlassSurface>
          </Pressable>

          {/* Location card */}
          <GlassSurface
            borderRadius={32}
            style={styles.detailCardGlass}
            contentStyle={[styles.detailCardContent, styles.detailCardCompact]}
          >
            <View style={styles.locationRow}>
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationMain}>Main Mats</Text>
                <Text style={styles.locationSub}>971 MMA Headquarters, Dubai</Text>
              </View>
              <Pressable
                onPress={openLocation}
                accessibilityRole="button"
                accessibilityLabel="Open location in maps"
                style={({ pressed }) => [styles.locationAction, pressed && styles.locationActionPressed]}
              >
                <MapPin size={20} color="#333333" strokeWidth={2.2} />
              </Pressable>
            </View>
          </GlassSurface>

          {/* Capacity card */}
          <GlassSurface
            borderRadius={32}
            style={styles.detailCardGlass}
            contentStyle={[styles.detailCardContent, styles.detailCardCapacity]}
          >
            <View style={styles.capacityTopRow}>
              <View style={styles.capacityColumn}>
                <Text style={styles.capacityMetricLabel}>CAPACITY</Text>
                <Text style={styles.capacityMetricValue}>
                  {item.bookedCount}/{capacityTotal}
                </Text>
              </View>
              <View style={[styles.capacityColumn, styles.capacityColumnRight]}>
                <Text
                  style={[
                    styles.capacityMetricLabel,
                    showStatusWarning ? styles.statusMetricLabel : null,
                  ]}
                >
                  STATUS
                </Text>
                <View style={styles.statusValueRow}>
                  {showStatusWarning ? (
                    <AlertTriangle size={14} color={statusColor} strokeWidth={2.5} />
                  ) : null}
                  <Text style={[styles.statusMetricValue, { color: statusColor }]}>
                    {statusHeadline}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPercentage}%`,
                    backgroundColor: isFull ? '#D71920' : '#007A33',
                  },
                ]}
              />
            </View>

            <Text style={styles.spotsRemaining}>{spotsRemainingLabel}</Text>
            <View style={styles.capacityDivider} />
          </GlassSurface>

        </View>
      </Animated.ScrollView>

      <ClassReminderSubscribeBar item={item} canSubscribe={canSubscribeToClass} />

      {/* Floating liquid-glass nav chrome over hero */}
      <View
        pointerEvents="box-none"
        style={[
          styles.floatingNav,
          {
            top: safeInsets.top + NAV_CHROME.topInset,
            paddingHorizontal: NAV_CHROME.horizontalInset,
          },
        ]}
      >
        <GlassNavChrome
          onPress={() => {
            triggerLightImpact();
            router.back();
          }}
          accessibilityLabel="Go back"
          style={styles.floatingNavButton}
          contentStyle={styles.floatingNavButtonInner}
        >
          <Ionicons name="chevron-back" size={NAV_CHROME.iconSize} color={UAE.ink} />
        </GlassNavChrome>

        <GlassNavChrome
          onPress={shareClass}
          accessibilityLabel="Share class"
          style={styles.floatingNavButton}
          contentStyle={styles.floatingNavButtonInner}
        >
          <Ionicons name="share-outline" size={NAV_CHROME.iconSize} color={UAE.ink} />
        </GlassNavChrome>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  hero: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#111111',
  },
  floatingNav: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 1000,
  },
  floatingNavButton: {
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  floatingNavButtonInner: {
    flex: 1,
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  floatingCardWrap: {
    marginHorizontal: 16,
    marginTop: -50,
    zIndex: 5,
  },
  floatingCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EFEFEF',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    width: '100%',
  },
  floatingCardContent: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    padding: 20,
    gap: 10,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  disciplineTag: {
    backgroundColor: '#111111',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  disciplineTagText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  levelTag: {
    backgroundColor: '#F1F3F5',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelTagText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: '#333333',
    letterSpacing: 0.5,
  },
  liveTag: {
    backgroundColor: '#007A33',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cancelledTag: {
    backgroundColor: '#D71920',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveTagText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: 'GeneralSans-Bold',
    fontSize: 24,
    color: '#000000',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIcon: {
    marginRight: 6,
  },
  calendarText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#555555',
    flex: 1,
  },
  disciplineLine: {
    color: '#007A33',
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    color: '#9CA3AF',
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  descriptionText: {
    color: '#444444',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  infoContainer: {
    gap: 14,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  detailCardGlass: {
    width: '100%',
  },
  detailCardContent: {
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  detailCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  detailCardCompact: {
    paddingVertical: 22,
  },
  detailCardCapacity: {
    paddingBottom: 0,
  },
  instructorAvatarLarge: {
    alignSelf: 'center',
    backgroundColor: '#EFEFEF',
    borderRadius: 44,
    height: 88,
    marginBottom: 16,
    width: 88,
  },
  instructorNameCentered: {
    color: '#000000',
    fontFamily: 'GeneralSans-Bold',
    fontSize: 22,
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  instructorRoleCentered: {
    color: '#007A33',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  instructorBioCentered: {
    color: '#666666',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationMain: {
    color: '#000000',
    fontFamily: 'GeneralSans-Bold',
    fontSize: 18,
    letterSpacing: -0.2,
  },
  locationSub: {
    color: '#7A7A7A',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 4,
  },
  locationAction: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 28,
    elevation: 2,
    height: 56,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    width: 56,
  },
  locationActionPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  capacityTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  capacityColumn: {
    gap: 6,
  },
  capacityColumnRight: {
    alignItems: 'flex-end',
  },
  capacityMetricLabel: {
    color: '#9CA3AF',
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1,
  },
  statusMetricLabel: {
    color: '#D71920',
  },
  capacityMetricValue: {
    color: '#000000',
    fontFamily: 'GeneralSans-Bold',
    fontSize: 28,
    letterSpacing: -0.5,
  },
  statusValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  statusMetricValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  progressTrack: {
    backgroundColor: '#ECEFF3',
    borderRadius: 999,
    height: 8,
    marginBottom: 12,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    borderRadius: 999,
    height: '100%',
  },
  spotsRemaining: {
    color: '#7A7A7A',
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'center',
  },
  capacityDivider: {
    backgroundColor: '#ECEFF3',
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
