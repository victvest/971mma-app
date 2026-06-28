import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppScrollView } from '@/shared/components/ui';
import { triggerSelectionHaptic } from '@/shared/haptics';
import type { CoachSpotlightTestimonial } from '@/features/coaches/utils/coachSpotlightTestimonials';

const CARD_PEEK = 28;
const SECTION_INSET = 16;
const CARD_GAP = 12;

type Props = {
  testimonials: CoachSpotlightTestimonial[];
};

type SpotlightCardProps = {
  item: CoachSpotlightTestimonial;
  width: number;
};

const SpotlightCard = memo(function SpotlightCard({ item, width }: SpotlightCardProps) {
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.starRow}>
        {Array.from({ length: 5 }, (_, index) => (
          <Ionicons
            key={index}
            name={index < item.rating ? 'star' : 'star-outline'}
            size={14}
            color="#007A33"
          />
        ))}
      </View>

      <Text style={styles.headline}>{item.headline}</Text>
      <Text style={styles.quote} numberOfLines={5}>
        “{item.quote}”
      </Text>

      <View style={styles.authorRow}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" />
        <View style={styles.authorText}>
          <Text style={styles.studentName}>{item.student}</Text>
          <Text style={styles.studentRank}>{item.rank}</Text>
        </View>
      </View>
    </View>
  );
});

export function CoachSpotlightCarousel({ testimonials }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const lastIndexRef = useRef(0);

  const cardWidth = screenWidth - SECTION_INSET - CARD_PEEK;
  const snapOffsets = useMemo(
    () => testimonials.map((_, index) => index * (cardWidth + CARD_GAP)),
    [cardWidth, testimonials],
  );

  const bleedStyle = useMemo(
    () => [styles.bleedShell, { marginHorizontal: -SECTION_INSET, width: screenWidth }],
    [screenWidth],
  );

  const contentStyle = useMemo(
    () => ({
      flexDirection: 'row' as const,
      gap: CARD_GAP,
      paddingLeft: SECTION_INSET,
      paddingRight: CARD_PEEK,
    }),
    [],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(offsetX / (cardWidth + CARD_GAP));
      const clamped = Math.max(0, Math.min(nextIndex, testimonials.length - 1));

      if (clamped !== lastIndexRef.current) {
        lastIndexRef.current = clamped;
        setActiveIndex(clamped);
        triggerSelectionHaptic();
      }
    },
    [cardWidth, testimonials.length],
  );

  if (testimonials.length === 0) {
    return null;
  }

  const showPagination = testimonials.length > 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Student Spotlight</Text>
        <Text style={styles.countLabel}>{testimonials.length} stories</Text>
      </View>

      <View style={bleedStyle}>
        <AppScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          alwaysBounceHorizontal={false}
          decelerationRate="fast"
          snapToOffsets={snapOffsets}
          snapToAlignment="start"
          disableIntervalMomentum
          scrollEventThrottle={16}
          onScroll={handleScroll}
          contentContainerStyle={contentStyle}
        >
          {testimonials.map((item) => (
            <SpotlightCard key={item.id} item={item} width={cardWidth} />
          ))}
        </AppScrollView>
      </View>

      {showPagination ? (
        <View style={styles.pagination}>
          {testimonials.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.dot,
                index === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  headerRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#000000',
    fontFamily: 'GeneralSans-Bold',
    fontSize: 20,
    letterSpacing: -0.2,
  },
  countLabel: {
    color: '#7A7A7A',
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  bleedShell: {
    overflow: 'hidden',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EFEFEF',
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    gap: 10,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  headline: {
    color: '#000000',
    fontFamily: 'GeneralSans-Bold',
    fontSize: 17,
    letterSpacing: -0.2,
  },
  quote: {
    color: '#444444',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  authorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  avatar: {
    borderRadius: 18,
    height: 36,
    marginRight: 10,
    width: 36,
  },
  authorText: {
    flex: 1,
    gap: 2,
  },
  studentName: {
    color: '#000000',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  studentRank: {
    color: '#7A7A7A',
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  pagination: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  dot: {
    borderRadius: 3,
    height: 6,
  },
  dotActive: {
    backgroundColor: '#007A33',
    width: 18,
  },
  dotInactive: {
    backgroundColor: '#D8DDE3',
    width: 6,
  },
});
