import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RollCallSwipeableCard,
  type RollCallSwipeableCardHandle,
} from '@/features/coach/roll-call/components/RollCallSwipeableCard';
import { RollCallCardSkeleton } from '@/features/coach/roll-call/components/RollCallCardSkeleton';
import { ROLL_CALL_CARD_MOCK_MEMBERS } from '@/features/coach/roll-call/fixtures/rollCallCardMocks';
import type { RollCallSwipeCommit } from '@/features/coach/roll-call/utils/rollCallGestures';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

export default function RollCallPreviewScreen() {
  const { colors, inset, radius, typography, gap } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardRef = useRef<RollCallSwipeableCardHandle>(null);
  const [index, setIndex] = useState(0);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [lastCommit, setLastCommit] = useState<RollCallSwipeCommit | null>(null);
  const [undoSignal, setUndoSignal] = useState(0);

  const cardHeight = useMemo(
    () => Math.max(420, height - insets.top - insets.bottom - 168),
    [height, insets.bottom, insets.top],
  );

  const cardWidth = width - inset.lg * 2;
  const member = ROLL_CALL_CARD_MOCK_MEMBERS[index] ?? ROLL_CALL_CARD_MOCK_MEMBERS[0];

  const cycleMember = useCallback(() => {
    triggerSelectionHaptic();
    setIndex((current) => (current + 1) % ROLL_CALL_CARD_MOCK_MEMBERS.length);
    setShowSkeleton(false);
    setLastCommit(null);
  }, []);

  const toggleSkeleton = useCallback(() => {
    triggerSelectionHaptic();
    setShowSkeleton((value) => !value);
  }, []);

  const handleCommit = useCallback((direction: RollCallSwipeCommit) => {
    setLastCommit(direction);
  }, []);

  const handleUndo = useCallback(() => {
    triggerSelectionHaptic();
    setUndoSignal((value) => value + 1);
    cardRef.current?.undo();
    setLastCommit(null);
  }, []);

  const statusLabel =
    lastCommit === 'attended'
      ? 'Marked present'
      : lastCommit === 'absent'
        ? 'Marked absent'
        : 'Swipe right = present · left = absent';

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background.primary,
          paddingTop: insets.top + inset.md,
          paddingBottom: insets.bottom + inset.md,
          paddingHorizontal: inset.lg,
          gap: gap.md,
        },
      ]}
    >
      <Text style={[typography.textPresets.screenEyebrow, { color: colors.text.secondary }]}>
        Roll call preview
      </Text>
      <Text style={[typography.textPresets.footnote, { color: colors.text.tertiary }]}>
        {statusLabel}
      </Text>

      <View style={[styles.cardFrame, { width: cardWidth, height: cardHeight }]}>
        {showSkeleton ? (
          <RollCallCardSkeleton style={styles.cardFill} />
        ) : (
          <RollCallSwipeableCard
            ref={cardRef}
            member={member}
            screenWidth={cardWidth}
            screenHeight={height}
            undoSignal={undoSignal}
            onCommit={handleCommit}
            style={styles.cardFill}
          />
        )}
      </View>

      <View style={[styles.actions, { gap: gap.sm }]}>
        <MotiPressable
          onPress={handleUndo}
          accessibilityLabel="Undo last swipe"
          style={[
            styles.actionButton,
            {
              minHeight: 48,
              borderRadius: radius.button,
              backgroundColor: colors.surface.primary,
              borderColor: colors.border.default,
              borderWidth: 1,
              paddingHorizontal: inset.lg,
            },
          ]}
        >
          <Text style={[typography.textPresets.button, { color: colors.text.primary }]}>Undo</Text>
        </MotiPressable>

        <MotiPressable
          onPress={cycleMember}
          accessibilityLabel="Cycle mock member"
          style={[
            styles.actionButton,
            {
              minHeight: 48,
              borderRadius: radius.button,
              backgroundColor: colors.accent.default,
              paddingHorizontal: inset.lg,
            },
          ]}
        >
          <Text style={[typography.textPresets.button, { color: colors.accent.onAccent }]}>
            Next mock member
          </Text>
        </MotiPressable>

        <MotiPressable
          onPress={toggleSkeleton}
          accessibilityLabel="Toggle skeleton state"
          style={[
            styles.actionButton,
            {
              minHeight: 48,
              borderRadius: radius.button,
              backgroundColor: colors.surface.primary,
              borderColor: colors.border.default,
              borderWidth: 1,
              paddingHorizontal: inset.lg,
            },
          ]}
        >
          <Text style={[typography.textPresets.button, { color: colors.text.primary }]}>
            {showSkeleton ? 'Show card' : 'Show skeleton'}
          </Text>
        </MotiPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  cardFrame: {
    alignSelf: 'center',
  },
  cardFill: {
    flex: 1,
  },
  actions: {
    alignItems: 'stretch',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
