import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useCoachClasses, useCoachDetail, useCoachDisciplines } from '@/features/coaches/hooks/useCoaches';
import {
  getCoachImageSource,
  getCoachRatingLabel,
  RatingPill,
} from '@/features/coaches/components/CoachVisuals';
import { GlassNavChrome, GlassSurface } from '@/features/home/components/navigation/GlassNavChrome';
import { NAV_CHROME, UAE } from '@/features/home/components/navigation/uaeChrome';
import { UaeBrandAmbientGlow } from '@/shared/components/brand';
import { StateBlock } from '@/shared/components/StateBlock';
import { triggerLightImpact, triggerMediumImpact } from '@/shared/haptics';
import { formatGymDisplay } from '@/core/time/gymTime';
import { formatDisciplineLabel } from '@/features/schedule/utils/classDisplay';
import { Ionicons } from '@expo/vector-icons';
import { Award, Globe, Medal, Shield } from 'lucide-react-native';
import type { ClassItem, CoachItem } from '@/types/domain';

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionSpacing}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PillList({ items }: { items: string[] }) {
  return (
    <View style={styles.pillRow}>
      {items.map((item) => (
        <View key={item} style={styles.specialtyPill}>
          <Text style={styles.specialtyText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function CoachStatsRow({ coach, classCount }: { coach: CoachItem; classCount: number }) {
  const hasRating = coach.rating !== null && coach.rating !== undefined;

  return (
    <GlassSurface borderRadius={20} style={styles.statsGlass} contentStyle={styles.statsContent}>
      <View style={styles.statCol}>
        <Text style={styles.statValue}>{coach.yearsExperience ?? '—'}</Text>
        <Text style={styles.statLabel}>Years</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statCol}>
        <Text style={styles.statValue}>{classCount}</Text>
        <Text style={styles.statLabel}>Classes</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statCol}>
        <Text style={styles.statValue}>{hasRating ? coach.rating!.toFixed(1) : '—'}</Text>
        <Text style={styles.statLabel}>Rating</Text>
      </View>
    </GlassSurface>
  );
}

function ClassPreviewCard({ item, onPress }: { item: ClassItem; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.classCard, pressed && styles.classCardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View class ${item.title}`}
    >
      <View style={styles.classInfo}>
        <Text style={styles.classTitle}>{item.title}</Text>
        <Text style={styles.classMeta}>{formatDisciplineLabel(item)}</Text>
        <Text style={styles.classTime}>{formatGymDisplay(item.startsAt)}</Text>
        <Text style={styles.classSpots}>
          {item.capacity > 0
            ? `${Math.max(item.capacity - item.bookedCount, 0)} spots left · ${item.durationMinutes} min`
            : `${item.durationMinutes} min`}
        </Text>
      </View>
      <View style={styles.viewChevron}>
        <Ionicons name="chevron-forward" size={16} color="#007A33" />
      </View>
    </Pressable>
  );
}

export default function CoachDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const safeInsets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const coachId = typeof id === 'string' ? id : undefined;

  const coachQuery = useCoachDetail(coachId);
  const coach = coachQuery.data;
  const classesQuery = useCoachClasses(coachId);
  const disciplinesQuery = useCoachDisciplines(coachId);
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const visibleClasses = useMemo(() => classes.slice(0, 5), [classes]);

  const openClass = useCallback(
    (classId: string) => {
      triggerLightImpact();
      router.push(`/classes/${classId}?origin=schedule`);
    },
    [router],
  );

  const openSchedule = useCallback(() => {
    triggerLightImpact();
    router.push('/(tabs)/schedule');
  }, [router]);

  const coachFirstName = useMemo(() => (coach?.name ? firstName(coach.name) : 'Coach'), [coach?.name]);

  const disciplineLabels = useMemo(() => {
    const fromDb = (disciplinesQuery.data ?? []).map((item) => item.displayName);
    if (fromDb.length > 0) return fromDb;
    if (!coach?.specialty) return [];
    return coach.specialty.split(',').map((s) => s.trim()).filter(Boolean);
  }, [coach?.specialty, disciplinesQuery.data]);

  if (coachQuery.isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StateBlock kind="loading" title="Loading coach profile" />
      </View>
    );
  }

  if (coachQuery.error || !coach) {
    return (
      <View style={[styles.container, styles.center]}>
        <StateBlock
          kind="error"
          title={!coach ? 'Coach not found' : 'Could not load coach'}
          message="Please check your connection and try again."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const heroHeight = Math.min(height * 0.52, 440);
  const rating = getCoachRatingLabel(coach);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.heroContainer, { height: heroHeight }]}>
          <Image
            source={getCoachImageSource(coach)}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
            style={StyleSheet.absoluteFill}
          />
          <UaeBrandAmbientGlow variant="photo-hero" topInset={safeInsets.top} />
        </View>

        <View style={styles.floatingCardWrap}>
          <View style={styles.floatingCard}>
            <View style={styles.floatingCardContent}>
              <View style={styles.nameRow}>
                <Text style={styles.coachName} numberOfLines={2}>
                  {coach.name}
                </Text>
                <Ionicons name="checkmark-circle" size={22} color="#007A33" style={styles.verifiedIcon} />
              </View>

              <View style={styles.heroBadgeRow}>
                {coach.rank ? (
                  <View style={styles.rankBadge}>
                    <Award size={14} color="#FFFFFF" style={styles.rankIcon} />
                    <Text style={styles.rankText}>{coach.rank}</Text>
                  </View>
                ) : null}
                {coach.rating !== null && coach.rating !== undefined ? <RatingPill rating={rating} /> : null}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <CoachStatsRow coach={coach} classCount={classes.length} />

          {coach.bio?.trim() ? (
            <InfoSection title={`About ${coachFirstName}`}>
              <Text style={styles.bioText}>{coach.bio.trim()}</Text>
            </InfoSection>
          ) : null}

          {coach.coachingPhilosophy?.trim() ? (
            <InfoSection title="Coaching philosophy">
              <Text style={styles.bioText}>{coach.coachingPhilosophy.trim()}</Text>
            </InfoSection>
          ) : null}

          {disciplineLabels.length > 0 ? (
            <InfoSection title="Disciplines">
              <PillList items={disciplineLabels} />
            </InfoSection>
          ) : null}

          {coach.fightRecord?.trim() ? (
            <InfoSection title="Competition record">
              <View style={styles.iconRow}>
                <Shield size={18} color="#007A33" strokeWidth={2.2} />
                <Text style={styles.iconRowText}>{coach.fightRecord.trim()}</Text>
              </View>
            </InfoSection>
          ) : null}

          {coach.titles.length > 0 ? (
            <InfoSection title="Titles & achievements">
              {coach.titles.map((title) => (
                <View key={title} style={styles.listRow}>
                  <Medal size={16} color="#007A33" strokeWidth={2.2} />
                  <Text style={styles.listRowText}>{title}</Text>
                </View>
              ))}
            </InfoSection>
          ) : null}

          {coach.certifications.length > 0 ? (
            <InfoSection title="Certifications">
              {coach.certifications.map((cert) => (
                <View key={cert} style={styles.listRow}>
                  <Ionicons name="ribbon-outline" size={16} color="#007A33" />
                  <Text style={styles.listRowText}>{cert}</Text>
                </View>
              ))}
            </InfoSection>
          ) : null}

          {coach.languages.length > 0 ? (
            <InfoSection title="Languages">
              <View style={styles.iconRow}>
                <Globe size={18} color="#007A33" strokeWidth={2.2} />
                <Text style={styles.iconRowText}>{coach.languages.join(' · ')}</Text>
              </View>
            </InfoSection>
          ) : null}

          <View style={styles.sectionSpacing}>
            <View style={styles.upcomingHeader}>
              <Text style={styles.sectionTitle}>Upcoming classes</Text>
              <Pressable onPress={openSchedule} hitSlop={12}>
                <Text style={styles.viewAllText}>VIEW ALL</Text>
              </Pressable>
            </View>

            {classesQuery.isLoading ? (
              <Text style={styles.statusPlaceholder}>Loading schedule...</Text>
            ) : visibleClasses.length === 0 ? (
              <View style={styles.emptyClassesCard}>
                <Text style={styles.emptyClassesText}>No upcoming classes scheduled.</Text>
              </View>
            ) : (
              <View style={styles.classesList}>
                {visibleClasses.map((item) => (
                  <ClassPreviewCard key={item.id} item={item} onPress={() => openClass(item.id)} />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

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
          onPress={() => {
            triggerMediumImpact();
          }}
          accessibilityLabel="Share profile"
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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  heroContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#111111',
    overflow: 'hidden',
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
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  coachName: {
    color: '#000000',
    flex: 1,
    flexShrink: 1,
    fontFamily: 'GeneralSans-Bold',
    fontSize: 26,
    letterSpacing: -0.5,
    minWidth: 0,
  },
  verifiedIcon: {
    flexShrink: 0,
  },
  heroBadgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rankIcon: {
    marginRight: 6,
  },
  rankText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  infoContainer: {
    paddingHorizontal: 16,
    marginTop: 28,
    gap: 28,
  },
  statsGlass: {
    width: '100%',
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  statValue: {
    color: '#000000',
    fontFamily: 'GeneralSans-Bold',
    fontSize: 24,
    letterSpacing: -0.3,
  },
  statLabel: {
    color: '#9CA3AF',
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statDivider: {
    alignSelf: 'stretch',
    backgroundColor: '#ECEFF3',
    width: StyleSheet.hairlineWidth,
  },
  sectionSpacing: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'GeneralSans-Bold',
    fontSize: 20,
    color: '#000000',
    letterSpacing: -0.2,
  },
  bioText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#444444',
    lineHeight: 22,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyPill: {
    backgroundColor: '#F1F3F5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  specialtyText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#333333',
  },
  iconRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  iconRowText: {
    color: '#444444',
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  listRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  listRowText: {
    color: '#444444',
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#007A33',
    letterSpacing: 0.5,
  },
  statusPlaceholder: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#7A7A7A',
    fontStyle: 'italic',
  },
  emptyClassesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  emptyClassesText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#7A7A7A',
    textAlign: 'center',
  },
  classesList: {
    gap: 10,
  },
  classCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderLeftWidth: 4,
    borderLeftColor: '#007A33',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  classCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  classInfo: {
    flex: 1,
    marginRight: 12,
    gap: 2,
  },
  classTitle: {
    fontFamily: 'GeneralSans-Bold',
    fontSize: 16,
    color: '#000000',
  },
  classMeta: {
    color: '#007A33',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  classTime: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#555555',
    marginTop: 2,
  },
  classSpots: {
    color: '#7A7A7A',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  viewChevron: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F3F5',
    borderRadius: 14,
  },
});
