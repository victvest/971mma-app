import React, { useCallback, useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { EntryCheckinNeedsConfirmation } from '@/features/gate/types';
import { formatGymTime12h } from '@/core/time/gymTime';
import { Button } from '@/shared/components/ui/Button';
import { StateBlock } from '@/shared/components/StateBlock';
import { triggerSuccessNotification } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';

const ON_INVERSE = {
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.65)',
  subtle: 'rgba(255,255,255,0.45)',
} as const;

type SuccessProps = {
  memberName: string;
  visible: boolean;
  onDismiss: () => void;
};

export function EntranceScanSuccess({ memberName, visible, onDismiss }: SuccessProps) {
  const { colors, typography, inset, gap, radius } = useTheme();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 0.6;
      opacity.value = 0;
      return;
    }

    triggerSuccessNotification();
    opacity.value = withTiming(1, animations.timing.fade);
    scale.value = withSpring(1, animations.spring.gentle);

    const timer = setTimeout(onDismiss, 3_000);
    return () => clearTimeout(timer);
  }, [onDismiss, opacity, scale, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.background.inverse + 'F2' }]}>
      <Animated.View style={[styles.successBody, animatedStyle, { gap: gap.md, padding: inset.lg }]}>
        <Ionicons name="checkmark-circle" size={72} color={colors.status.success} />
        <Text style={[typography.textPresets.title, { color: ON_INVERSE.text, textAlign: 'center' }]}>
          Welcome, {memberName}
        </Text>
        <Text style={[typography.textPresets.bodyMedium, { color: ON_INVERSE.muted, textAlign: 'center' }]}>
          +10 points
        </Text>
      </Animated.View>
    </View>
  );
}

type CheckedInProps = {
  memberName: string;
  checkedInAt: string;
};

export function EntranceCheckedInCard({ memberName, checkedInAt }: CheckedInProps) {
  const { colors, typography, inset, gap, radius } = useTheme();
  const router = useRouter();

  const handleRewards = useCallback(() => {
    router.push('/(tabs)/rewards');
  }, [router]);

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${memberName} checked in today at ${formatGymTime12h(checkedInAt)}`}
      style={[
        styles.card,
        {
          borderRadius: radius.cardLarge,
          backgroundColor: colors.background.inverse,
          padding: inset.lg,
          paddingTop: inset.lg,
          gap: gap.lg,
          borderColor: colors.border.onPromo,
          borderWidth: 1,
          overflow: 'hidden',
        },
      ]}
    >
      <View style={[styles.statusPill, { borderRadius: radius.pill, backgroundColor: colors.status.success + '22' }]}>
        <View style={[styles.liveDot, { backgroundColor: colors.status.success }]} />
        <Text style={[styles.pillLabel, { color: colors.status.success }]}>CHECKED IN</Text>
      </View>
      <View style={{ gap: gap.sm, alignItems: 'center' }}>
        <Ionicons name="checkmark-circle" size={56} color={colors.status.success} />
        <Text style={[typography.textPresets.title, { color: ON_INVERSE.text, textAlign: 'center' }]}>
          {memberName}
        </Text>
        <Text style={[typography.textPresets.bodyMedium, { color: ON_INVERSE.muted, textAlign: 'center' }]}>
          Checked in at {formatGymTime12h(checkedInAt)}
        </Text>
      </View>
      <Button label="View rewards" onPress={handleRewards} variant="secondary" />
    </View>
  );
}

type ErrorProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EntranceScanError({ title, message, actionLabel, onAction }: ErrorProps) {
  return (
    <View style={styles.errorWrap}>
      <StateBlock
        kind="error"
        title={title}
        message={message}
        actionLabel={actionLabel}
        onAction={onAction}
      />
    </View>
  );
}

type GuardianProps = {
  pending: EntryCheckinNeedsConfirmation | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function EntranceGuardianConfirmModal({ pending, busy, onConfirm, onCancel }: GuardianProps) {
  const { colors, typography, inset, radius, gap } = useTheme();

  return (
    <Modal visible={Boolean(pending)} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.modalBackdrop, { backgroundColor: colors.background.overlay }]}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.surface.primary,
              borderRadius: radius.cardLarge,
              padding: inset.lg,
              gap: gap.md,
              borderColor: colors.border.subtle,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[typography.textPresets.title, { color: colors.text.primary }]}>
            Confirm check-in
          </Text>
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            {pending?.message ??
              `Confirm that ${pending?.memberName ?? 'your child'} is present at the academy before checking in.`}
          </Text>
          <Button label="Confirm and check in" onPress={onConfirm} loading={busy} />
          <Button label="Cancel" onPress={onCancel} variant="outline" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  successBody: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    minHeight: 420,
    justifyContent: 'space-between',
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  errorWrap: {
    flex: 1,
    minHeight: 320,
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
  },
});
