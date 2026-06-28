import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useCoachClasses, useCoachDetail } from '@/features/coaches/hooks/useCoaches';
import { getCoachImageSource } from '@/features/coaches/components/CoachVisuals';
import { GlassNavChrome, GlassSurface } from '@/features/home/components/navigation/GlassNavChrome';
import { NAV_CHROME, UAE } from '@/features/home/components/navigation/uaeChrome';
import { UaeBrandAmbientGlow } from '@/shared/components/brand';
import { StateBlock } from '@/shared/components/StateBlock';
import { triggerLightImpact, triggerMediumImpact } from '@/shared/haptics';
import { formatGymDisplay } from '@/core/time/gymTime';
import { Ionicons } from '@expo/vector-icons';
import { Award } from 'lucide-react-native';

export default function CoachDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const safeInsets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  
  const coachId = typeof id === 'string' ? id : undefined;
  
  const coachQuery = useCoachDetail(coachId);
  const coach = coachQuery.data;
  const classesQuery = useCoachClasses(coachId);
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const visibleClasses = useMemo(() => classes.slice(0, 5), [classes]);

  const openClass = useCallback(
    (classId: string) => {
      triggerLightImpact();
      router.push(`/classes/${classId}?origin=schedule`);
    },
    [router]
  );

  const openSchedule = useCallback(() => {
    triggerLightImpact();
    router.push('/(tabs)/schedule');
  }, [router]);

  // Extract first name
  const coachFirstName = useMemo(() => {
    if (!coach?.name) return 'Coach';
    return coach.name.trim().split(/\s+/)[0] ?? coach.name;
  }, [coach?.name]);

  // Only show real specialties — no generated fallback
  const specialties = useMemo(() => {
    if (!coach?.specialty) return [];
    return coach.specialty.split(',').map(s => s.trim()).filter(Boolean);
  }, [coach?.specialty]);

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
          title={!coach ? "Coach not found" : "Could not load coach"}
          message="Please check your connection and try again."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const heroHeight = Math.min(height * 0.52, 440);

  return (
    <View style={styles.container}>
      {/* Scrollable Content */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Image Container */}
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

        {/* Floating liquid-glass name card overlapping hero */}
        <View style={styles.floatingCardWrap}>
          <GlassSurface
            borderRadius={24}
            style={styles.floatingCardGlass}
            contentStyle={styles.floatingCardContent}
          >
            <View style={styles.nameRow}>
              <Text style={styles.coachName}>{coach.name}</Text>
              <Ionicons name="checkmark-circle" size={22} color="#007A33" style={styles.verifiedIcon} />
            </View>

            {coach.rank ? (
              <View style={styles.rankBadge}>
                <Award size={14} color="#FFFFFF" style={styles.rankIcon} />
                <Text style={styles.rankText}>{coach.rank}</Text>
              </View>
            ) : null}
          </GlassSurface>
        </View>

        {/* Info Sections Container */}
        <View style={styles.infoContainer}>
          {/* About Section — only show if real bio exists */}
          {coach.bio?.trim() ? (
            <>
              <Text style={styles.sectionTitle}>About {coachFirstName}</Text>
              <Text style={styles.bioText}>{coach.bio.trim()}</Text>
            </>
          ) : null}

          {/* Specialties Section — only if real specialties */}
          {specialties.length > 0 ? (
            <View style={styles.sectionSpacing}>
              <Text style={styles.sectionTitle}>Specialties</Text>
              <View style={styles.specialtiesRow}>
                {specialties.map((specialty, index) => (
                  <View key={index} style={styles.specialtyPill}>
                    <Text style={styles.specialtyText}>{specialty}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Upcoming Classes Section */}
          <View style={coach.bio?.trim() || specialties.length > 0 ? styles.sectionSpacing : undefined}>
            <View style={styles.upcomingHeader}>
              <Text style={styles.sectionTitle}>Upcoming Classes</Text>
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
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.classCard, pressed && styles.classCardPressed]}
                    onPress={() => openClass(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`View class ${item.title}`}
                  >
                    <View style={styles.classInfo}>
                      <Text style={styles.classTitle}>{item.title}</Text>
                      <Text style={styles.classTime}>{formatGymDisplay(item.startsAt)}</Text>
                    </View>
                    <View style={styles.viewChevron}>
                      <Ionicons name="chevron-forward" size={16} color="#007A33" />
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

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
          onPress={() => {
            triggerMediumImpact();
            // Share functionality placeholder
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
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: -50,
    zIndex: 5,
  },
  floatingCardGlass: {
    width: '100%',
  },
  floatingCardContent: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    padding: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  coachName: {
    fontFamily: 'GeneralSans-Bold',
    fontSize: 26,
    color: '#000000',
    letterSpacing: -0.5,
  },
  verifiedIcon: {
    marginLeft: 6,
    alignSelf: 'center',
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
  },
  sectionTitle: {
    fontFamily: 'GeneralSans-Bold',
    fontSize: 20,
    color: '#000000',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  bioText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#444444',
    lineHeight: 22,
  },
  sectionSpacing: {
    marginTop: 28,
  },
  specialtiesRow: {
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
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  },
  classTitle: {
    fontFamily: 'GeneralSans-Bold',
    fontSize: 16,
    color: '#000000',
    marginBottom: 4,
  },
  classTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#7A7A7A',
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
