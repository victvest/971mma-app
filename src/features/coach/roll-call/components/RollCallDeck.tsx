import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { RollCallCardSkeleton } from '@/features/coach/roll-call/components/RollCallCardSkeleton';
import { RollCallDeckFooter } from '@/features/coach/roll-call/components/RollCallDeckFooter';
import { RollCallDeckHeader } from '@/features/coach/roll-call/components/RollCallDeckHeader';
import { RollCallProgress } from '@/features/coach/roll-call/components/RollCallProgress';
import {
  RollCallSwipeableCard,
  type RollCallSwipeableCardHandle,
} from '@/features/coach/roll-call/components/RollCallSwipeableCard';
import { RollCallOfflineBanner } from '@/features/coach/roll-call/components/RollCallOfflineBanner';
import type { RollCallDeckMarkStatus } from '@/features/coach/roll-call/hooks/useRollCallDeckMarking';
import { useRollCallDeckImagePrefetch } from '@/features/coach/roll-call/hooks/useRollCallDeckImagePrefetch';
import type { RollCallDeckMember, RollCallMemberMark } from '@/features/coach/roll-call/types';
import type { RollCallSwipeCommit } from '@/features/coach/roll-call/utils/rollCallGestures';
import { swipeCommitToStatus } from '@/features/coach/roll-call/utils/optimisticRollCallMark';
import { mergeDeckWithServerMembers } from '@/features/coach/roll-call/utils/rollCallSearchUtils';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import { PerfMark, usePerfOnceReady } from '@/shared/performance';

type UndoEntry = {
  deckKey: string;
  previousMark: RollCallMemberMark | null;
};

type Props = {
  classId: string;
  classTitle: string;
  startsAt: string;
  members: RollCallDeckMember[];
  screenWidth: number;
  screenHeight: number;
  cardHeight: number;
  isLoading?: boolean;
  isRecording?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  onBackPress: () => void;
  reviewMode?: boolean;
  onDeckComplete?: () => void;
  onRecordMark: (member: RollCallDeckMember, status: RollCallDeckMarkStatus) => Promise<void>;
  onRevertMark?: (
    member: RollCallDeckMember,
    previousMark: RollCallMemberMark | null,
    removedMark: RollCallMemberMark | null,
  ) => Promise<void>;
  onRecordError?: (error: unknown) => void;
};

export const RollCallDeck = memo(function RollCallDeck({
  classId,
  classTitle,
  startsAt,
  members: initialMembers,
  screenWidth,
  screenHeight,
  cardHeight,
  isLoading = false,
  isRecording = false,
  contentStyle,
  onBackPress,
  reviewMode = false,
  onDeckComplete,
  onRecordMark,
  onRevertMark,
  onRecordError,
}: Props) {
  const { inset, gap } = useTheme();
  const swipeRef = useRef<RollCallSwipeableCardHandle>(null);
  const [members, setMembers] = useState(initialMembers);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [undoSignal, setUndoSignal] = useState(0);

  React.useEffect(() => {
    setMembers((current) => mergeDeckWithServerMembers(current, initialMembers));
  }, [initialMembers]);

  const unmarkedMembers = useMemo(
    () => members.filter((member) => member.mark === null),
    [members],
  );

  const currentMember = reviewMode
    ? (members[reviewIndex] ?? null)
    : (unmarkedMembers[0] ?? null);

  const completedCount = useMemo(
    () => members.filter((member) => member.mark !== null).length,
    [members],
  );

  React.useEffect(() => {
    if (!reviewMode) return;
    setReviewIndex((index) => Math.min(index, Math.max(0, members.length - 1)));
  }, [members.length, reviewMode]);

  usePerfOnceReady(
    PerfMark.rollCallFirstCardInteractive,
    !isLoading && currentMember !== null,
    { classId, memberCount: members.length },
  );

  useRollCallDeckImagePrefetch(reviewMode ? members : unmarkedMembers);

  const applyMark = useCallback((deckKey: string, mark: RollCallMemberMark | null) => {
    setMembers((current) =>
      current.map((member) => (member.deckKey === deckKey ? { ...member, mark } : member)),
    );
  }, []);

  const undoLastMark = useCallback(() => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;

    const member = members.find((entry) => entry.deckKey === last.deckKey);
    const removedMark = member?.mark ?? null;

    applyMark(last.deckKey, last.previousMark);
    setUndoStack((stack) => stack.slice(0, -1));
    setUndoSignal((value) => value + 1);
    swipeRef.current?.undo();

    if (member && onRevertMark) {
      void onRevertMark(member, last.previousMark, removedMark).catch(() => {
        applyMark(last.deckKey, removedMark);
        setUndoStack((stack) => [...stack, last]);
        setUndoSignal((value) => value + 1);
        swipeRef.current?.undo();
      });
    }
  }, [applyMark, members, onRevertMark, undoStack]);

  const recordMemberMark = useCallback(
    (member: RollCallDeckMember, status: RollCallDeckMarkStatus) => {
      const undoEntry = {
        deckKey: member.deckKey,
        previousMark: member.mark,
      };

      setUndoStack((stack) => [...stack, undoEntry]);

      return onRecordMark(member, status)
        .then(() => {
          if (reviewMode) {
            setReviewIndex((index) => Math.min(index + 1, members.length - 1));
            return;
          }

          const nextCompleted = completedCount + (member.mark ? 0 : 1);
          if (nextCompleted >= members.length) {
            onDeckComplete?.();
          }
        })
        .catch((error) => {
          setUndoStack((stack) => stack.slice(0, -1));
          setUndoSignal((value) => value + 1);
          swipeRef.current?.undo();
          onRecordError?.(error);
          throw error;
        });
    },
    [completedCount, members.length, onDeckComplete, onRecordError, onRecordMark, reviewMode],
  );

  const handleCommit = useCallback(
    (direction: RollCallSwipeCommit) => {
      if (!currentMember || isRecording) return;
      void recordMemberMark(currentMember, swipeCommitToStatus(direction));
    },
    [currentMember, isRecording, recordMemberMark],
  );

  const offlineBanner = useMemo(
    () => <RollCallOfflineBanner classId={classId} />,
    [classId],
  );

  const header = (
    <RollCallDeckHeader
      classId={classId}
      classTitle={classTitle}
      startsAt={startsAt}
      onBackPress={onBackPress}
    />
  );

  const progress = (
    <RollCallProgress completed={completedCount} total={members.length} />
  );

  if (isLoading) {
    return (
      <View style={[styles.screen, contentStyle]}>
        {header}
        <View
          style={[
            styles.body,
            { gap: gap.md, paddingHorizontal: inset.lg, paddingBottom: inset.lg },
          ]}
        >
          {offlineBanner}
          {progress}
          <View style={[styles.cardStack, { height: cardHeight, paddingHorizontal: inset.lg }]}>
            <RollCallCardSkeleton style={styles.cardFill} />
          </View>
        </View>
      </View>
    );
  }

  if (members.length === 0) {
    return (
      <View style={[styles.screen, contentStyle]}>
        {header}
        <View
          style={[
            styles.body,
            { gap: gap.md, paddingHorizontal: inset.lg, paddingBottom: inset.lg },
          ]}
        >
          {offlineBanner}
          <StateBlock
            kind="empty"
            title="No one on the roster"
            message="Open the class roster again or scan a member QR from the class screen."
          />
        </View>
      </View>
    );
  }

  if (!currentMember) {
    if (reviewMode) {
      return null;
    }

    return (
      <View style={[styles.screen, contentStyle]}>
        {header}
        <View
          style={[
            styles.body,
            { gap: gap.md, paddingHorizontal: inset.lg, paddingBottom: inset.lg },
          ]}
        >
          {offlineBanner}
          {progress}
          <StateBlock
            kind="loading"
            title="Opening summary"
            message="Everyone on the deck has been marked."
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, contentStyle]}>
      {header}
      <View style={[styles.body, { gap: gap.md, paddingBottom: inset.lg }]}>
        <View style={{ paddingHorizontal: inset.lg }}>{offlineBanner}</View>
        <View style={{ paddingHorizontal: inset.lg }}>{progress}</View>

        <View style={[styles.cardStack, { height: cardHeight }]}>
          <RollCallSwipeableCard
            key={currentMember.deckKey}
            ref={swipeRef}
            member={currentMember}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
            cardInset={inset.lg}
            enabled={!isRecording}
            undoSignal={undoSignal}
            onCommit={handleCommit}
            style={styles.cardFill}
          />
        </View>

        <View style={{ paddingHorizontal: inset.lg }}>
          <RollCallDeckFooter
            disabled={isRecording}
            canUndo={undoStack.length > 0}
            onUndo={undoLastMark}
          />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  cardStack: {
    flex: 1,
    overflow: 'visible',
    width: '100%',
  },
  cardFill: {
    flex: 1,
    width: '100%',
  },
});
