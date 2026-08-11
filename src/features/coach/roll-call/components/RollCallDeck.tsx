import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { RollCallDeckFooter } from '@/features/coach/roll-call/components/RollCallDeckFooter';
import { RollCallDeckHeader } from '@/features/coach/roll-call/components/RollCallDeckHeader';
import { RollCallEmptyState } from '@/features/coach/roll-call/components/RollCallEmptyState';
import { RollCallMemberActionsSheet } from '@/features/coach/roll-call/components/RollCallMemberActionsSheet';
import { RollCallProgress } from '@/features/coach/roll-call/components/RollCallProgress';
import {
  RollCallSwipeableCard,
  type RollCallSwipeableCardHandle,
} from '@/features/coach/roll-call/components/RollCallSwipeableCard';
import { RollCallOfflineBanner } from '@/features/coach/roll-call/components/RollCallOfflineBanner';
import type { RollCallDeckMarkStatus } from '@/features/coach/roll-call/hooks/useRollCallDeckMarking';
import { useRollCallDeckImagePrefetch } from '@/features/coach/roll-call/hooks/useRollCallDeckImagePrefetch';
import type { RollCallDeckMember, RollCallMemberMark } from '@/features/coach/roll-call/types';
import {
  type RollCallSwipeCommit,
} from '@/features/coach/roll-call/utils/rollCallGestures';
import {
  swipeCommitToStatus,
  buildOptimisticRollCallMark,
} from '@/features/coach/roll-call/utils/optimisticRollCallMark';
import {
  buildRollCallSwipeQueue,
  isEligibleForUnmarkedRollCallSwipe,
  isQrScanMarkedMember,
  mergeSwipeQueueKeys,
} from '@/features/coach/roll-call/utils/buildRollCallSwipeQueue';
import { mergeDeckWithServerMembers } from '@/features/coach/roll-call/utils/rollCallSearchUtils';
import { useAuthStore } from '@/stores/useAuthStore';
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
  members: RollCallDeckMember[];
  screenWidth: number;
  screenHeight: number;
  cardHeight: number;
  /** True only while the first successful roster payload is not ready yet. */
  isLoading?: boolean;
  isRecording?: boolean;
  isRemovingMember?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  onBackPress: () => void;
  onScanPress?: () => void;
  onRemoveMember?: (member: RollCallDeckMember) => Promise<void>;
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

function deckSyncSignatureOf(members: ReadonlyArray<RollCallDeckMember>): string {
  return members
    .map(
      (member) =>
        `${member.deckKey}:${member.mark?.id ?? ''}:${member.mark?.status ?? ''}:${member.mark?.method ?? ''}`,
    )
    .join('\0');
}

export const RollCallDeck = memo(
  function RollCallDeck({
    classId,
    classTitle,
    members: initialMembers,
    screenWidth,
    screenHeight,
    cardHeight,
    isLoading = false,
    isRecording = false,
    isRemovingMember = false,
    contentStyle,
    onBackPress,
    onScanPress,
    onRemoveMember,
    reviewMode = false,
    onDeckComplete,
    onRecordMark,
    onRevertMark,
  }: Props) {
    const { colors, inset, gap } = useTheme();
    const coachId = useAuthStore((s) => s.user?.id ?? '');
    const swipeRef = useRef<RollCallSwipeableCardHandle>(null);
    const [members, setMembers] = useState(initialMembers);
    const [reviewIndex, setReviewIndex] = useState(0);
    const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
    const [undoSignal, setUndoSignal] = useState(0);
    const [memberMenuOpen, setMemberMenuOpen] = useState(false);
    const [reviewedQrKeys, setReviewedQrKeys] = useState(() => new Set<string>());
    /** Stable swipe order — advance a cursor instead of rebuilding the queue each mark. */
    const [queueKeys, setQueueKeys] = useState(() =>
      buildRollCallSwipeQueue(initialMembers).map((member) => member.deckKey),
    );
    const [cursor, setCursor] = useState(0);

    const onDeckCompleteRef = useRef(onDeckComplete);
    onDeckCompleteRef.current = onDeckComplete;
    const onRecordMarkRef = useRef(onRecordMark);
    onRecordMarkRef.current = onRecordMark;
    const onRevertMarkRef = useRef(onRevertMark);
    onRevertMarkRef.current = onRevertMark;

    const deckSyncSignature = useMemo(() => deckSyncSignatureOf(initialMembers), [initialMembers]);

    React.useEffect(() => {
      if (isLoading) return;
      setMembers((current) => mergeDeckWithServerMembers(current, initialMembers));
      // Sync marks + membership (QR adds) without resetting the cursor mid-pass.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- deckSyncSignature gates sync
    }, [deckSyncSignature, isLoading]);

    React.useEffect(() => {
      setQueueKeys((previous) => {
        const next = mergeSwipeQueueKeys(previous, members, reviewedQrKeys);
        if (
          next.length === previous.length &&
          next.every((key, index) => key === previous[index])
        ) {
          return previous;
        }
        return next;
      });
    }, [members, reviewedQrKeys]);

    const membersByKey = useMemo(() => {
      const map = new Map<string, RollCallDeckMember>();
      for (const member of members) map.set(member.deckKey, member);
      return map;
    }, [members]);

    /** Full stable queue with absolute indices — required for smooth stack rise. */
    const queueMembers = useMemo(() => {
      return queueKeys
        .map((key) => membersByKey.get(key))
        .filter((member): member is RollCallDeckMember => Boolean(member));
    }, [membersByKey, queueKeys]);

    const swipeMembers = reviewMode ? members : queueMembers;
    const swipeIndex = reviewMode ? reviewIndex : cursor;
    const currentMember = swipeMembers[swipeIndex] ?? null;
    const isQrAcknowledge = Boolean(currentMember && isQrScanMarkedMember(currentMember));

    const remainingAfterCursor = useMemo(() => {
      if (reviewMode) {
        return members.slice(reviewIndex);
      }
      return queueKeys.slice(cursor).filter((key) => {
        const member = membersByKey.get(key);
        if (!member) return false;
        if (isEligibleForUnmarkedRollCallSwipe(member)) return true;
        if (isQrScanMarkedMember(member) && !reviewedQrKeys.has(key)) return true;
        return false;
      });
    }, [cursor, members, membersByKey, queueKeys, reviewIndex, reviewMode, reviewedQrKeys]);

    const completedCount = useMemo(
      () => members.filter((member) => member.mark !== null).length,
      [members],
    );

    const unmarkedForPrefetch = useMemo(
      () =>
        members.filter(
          (member) =>
            isEligibleForUnmarkedRollCallSwipe(member) || isQrScanMarkedMember(member),
        ),
      [members],
    );

    React.useEffect(() => {
      if (!reviewMode) return;
      setReviewIndex((index) => Math.min(index, Math.max(0, members.length - 1)));
    }, [members.length, reviewMode]);

    React.useEffect(() => {
      if (!currentMember) setMemberMenuOpen(false);
    }, [currentMember]);

    usePerfOnceReady(PerfMark.rollCallFirstCardInteractive, !isLoading && currentMember !== null, {
      classId,
      memberCount: members.length,
    });

    useRollCallDeckImagePrefetch(reviewMode ? members : unmarkedForPrefetch);

    const showScan = members.length === 0;
    const showMemberMenu = Boolean(currentMember && onRemoveMember);

    const applyMark = useCallback((deckKey: string, mark: RollCallMemberMark | null) => {
      setMembers((current) =>
        current.map((member) => (member.deckKey === deckKey ? { ...member, mark } : member)),
      );
    }, []);

    const advancePast = useCallback(
      (deckKey: string) => {
        setCursor((current) => {
          const index = queueKeys.indexOf(deckKey, current);
          if (index < 0) return current + 1;
          return index + 1;
        });
      },
      [queueKeys],
    );

    const undoLastMark = useCallback(() => {
      const last = undoStack[undoStack.length - 1];
      if (!last) return;

      const member = members.find((entry) => entry.deckKey === last.deckKey);
      const removedMark = member?.mark ?? null;

      applyMark(last.deckKey, last.previousMark);
      setUndoStack((stack) => stack.slice(0, -1));
      setUndoSignal((value) => value + 1);
      setCursor((current) => {
        const index = queueKeys.indexOf(last.deckKey);
        if (index < 0) return Math.max(0, current - 1);
        return Math.min(current, index);
      });
      setReviewedQrKeys((current) => {
        if (!current.has(last.deckKey)) return current;
        const next = new Set(current);
        next.delete(last.deckKey);
        return next;
      });
      swipeRef.current?.undo();

      if (member && onRevertMarkRef.current) {
        void onRevertMarkRef.current(member, last.previousMark, removedMark).catch(() => {
          applyMark(last.deckKey, removedMark);
          setUndoStack((stack) => [...stack, last]);
          setUndoSignal((value) => value + 1);
          swipeRef.current?.undo();
        });
      }
    }, [applyMark, members, queueKeys, undoStack]);

    const recordMemberMark = useCallback(
      (member: RollCallDeckMember, status: RollCallDeckMarkStatus) => {
        const undoEntry = {
          deckKey: member.deckKey,
          previousMark: member.mark,
        };

        setUndoStack((stack) => [...stack, undoEntry]);
        applyMark(member.deckKey, buildOptimisticRollCallMark(status, coachId));
        advancePast(member.deckKey);

        // Keep swipe paint free of parent cache work.
        queueMicrotask(() => {
          void onRecordMarkRef.current(member, status);
        });

        if (reviewMode) {
          setReviewIndex((index) => Math.min(index + 1, members.length - 1));
          return;
        }

        const index = queueKeys.indexOf(member.deckKey);
        const nextCursorIndex = index < 0 ? cursor + 1 : index + 1;
        const stillQueued = queueKeys.slice(nextCursorIndex).some((key) => {
          const row = membersByKey.get(key);
          if (!row) return false;
          if (isEligibleForUnmarkedRollCallSwipe(row)) return true;
          return isQrScanMarkedMember(row) && !reviewedQrKeys.has(key);
        });

        if (!stillQueued) {
          onDeckCompleteRef.current?.();
        }
      },
      [
        advancePast,
        applyMark,
        coachId,
        cursor,
        members.length,
        membersByKey,
        queueKeys,
        reviewMode,
        reviewedQrKeys,
      ],
    );

    const handleCommit = useCallback(
      (direction: RollCallSwipeCommit) => {
        const member = currentMember;
        if (!member) return;

        // QR-present: recognition pass only — never change presence, just advance.
        if (isQrScanMarkedMember(member)) {
          const nextReviewed = new Set(reviewedQrKeys);
          nextReviewed.add(member.deckKey);
          setReviewedQrKeys(nextReviewed);
          advancePast(member.deckKey);

          const stillQueued = queueKeys.slice(queueKeys.indexOf(member.deckKey) + 1).some((key) => {
            const row = membersByKey.get(key);
            if (!row) return false;
            if (isEligibleForUnmarkedRollCallSwipe(row)) return true;
            return isQrScanMarkedMember(row) && !nextReviewed.has(key);
          });

          if (!stillQueued) {
            onDeckCompleteRef.current?.();
          }
          return;
        }

        const status = swipeCommitToStatus(direction);
        recordMemberMark(member, status);
      },
      [
        advancePast,
        currentMember,
        membersByKey,
        queueKeys,
        recordMemberMark,
        reviewedQrKeys,
      ],
    );

    const handleRemoveCurrentMember = useCallback(async () => {
      if (!currentMember || !onRemoveMember) return;
      await onRemoveMember(currentMember);
      setMembers((current) => current.filter((member) => member.deckKey !== currentMember.deckKey));
      setQueueKeys((current) => current.filter((key) => key !== currentMember.deckKey));
      setUndoStack((stack) => stack.filter((entry) => entry.deckKey !== currentMember.deckKey));
      setMemberMenuOpen(false);
    }, [currentMember, onRemoveMember]);

    const offlineBanner = useMemo(() => <RollCallOfflineBanner classId={classId} />, [classId]);

    const header = (
      <RollCallDeckHeader
        classTitle={classTitle}
        onBackPress={onBackPress}
        showScan={showScan}
        onScanPress={onScanPress}
        showMemberMenu={showMemberMenu}
        onMemberMenuPress={() => setMemberMenuOpen(true)}
      />
    );

    const progress = <RollCallProgress completed={completedCount} total={members.length} />;

    if (isLoading) {
      return (
        <View style={[styles.screen, contentStyle]}>
          {header}
          <View style={styles.loaderBody} accessibilityLabel="Loading roll call">
            <ActivityIndicator size="large" color={colors.text.tertiary} />
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
            {onScanPress ? (
              <RollCallEmptyState onScanPress={onScanPress} />
            ) : (
              <StateBlock
                kind="empty"
                title="No one on this list yet"
                message="Scan each member QR once to add them to this class list."
              />
            )}
          </View>
        </View>
      );
    }

    if (!currentMember || remainingAfterCursor.length === 0) {
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
              kind="empty"
              title="Ready for summary"
              message="Open the summary to confirm attendance and mark anyone who isn't checked in."
              actionLabel="Open summary"
              onAction={onDeckComplete}
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
              ref={swipeRef}
              members={swipeMembers}
              currentIndex={swipeIndex}
              screenWidth={screenWidth}
              screenHeight={screenHeight}
              cardInset={inset.lg}
              enabled={!isRecording && !isRemovingMember}
              acknowledgeOnly={isQrAcknowledge}
              undoSignal={undoSignal}
              onCommit={handleCommit}
              style={styles.cardFill}
            />
          </View>

          <View style={{ paddingHorizontal: inset.lg }}>
            <RollCallDeckFooter
              disabled={isRecording || isRemovingMember}
              canUndo={undoStack.length > 0}
              onUndo={undoLastMark}
            />
          </View>
        </View>

        <RollCallMemberActionsSheet
          visible={memberMenuOpen}
          memberName={currentMember.displayName}
          isRemoving={isRemovingMember}
          onDismiss={() => setMemberMenuOpen(false)}
          onRemove={() => {
            void handleRemoveCurrentMember();
          }}
        />
      </View>
    );
  },
  (prev, next) =>
    prev.classId === next.classId &&
    prev.classTitle === next.classTitle &&
    prev.screenWidth === next.screenWidth &&
    prev.screenHeight === next.screenHeight &&
    prev.cardHeight === next.cardHeight &&
    prev.isLoading === next.isLoading &&
    prev.isRecording === next.isRecording &&
    prev.isRemovingMember === next.isRemovingMember &&
    prev.reviewMode === next.reviewMode &&
    deckSyncSignatureOf(prev.members) === deckSyncSignatureOf(next.members),
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  loaderBody: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  cardStack: {
    flex: 1,
    overflow: 'visible',
    paddingTop: 36,
    width: '100%',
  },
  cardFill: {
    flex: 1,
    width: '100%',
  },
});
