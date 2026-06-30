import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CommunityAnnouncementComposer } from '@/features/communities/components/CommunityAnnouncementComposer';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type CommunityAnnouncementSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  initialChannelId?: string;
  lockChannel?: boolean;
};

export function CommunityAnnouncementSheet({
  visible,
  onDismiss,
  initialChannelId,
  lockChannel = false,
}: CommunityAnnouncementSheetProps) {
  const { colors, typography, inset, radius } = useTheme();
  const safeInsets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <View style={[styles.root, { backgroundColor: colors.background.primary }]}>
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.border.subtle,
              paddingHorizontal: inset.lg,
              paddingTop: safeInsets.top > 0 ? inset.sm : inset.lg,
              paddingBottom: inset.md,
            },
          ]}
        >
          <View style={styles.headerCopy}>
            <Text style={[typography.textPresets.title, { color: colors.text.primary, fontSize: 22 }]}>
              New announcement
            </Text>
            <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
              Members receive an in-app notification and push alert.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close announcement composer"
            onPress={() => {
              triggerSelectionHaptic();
              onDismiss();
            }}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: colors.fill.secondary,
                borderRadius: radius.pill,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="close" size={18} color={colors.text.primary} />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: safeInsets.bottom + inset.xl }}
        >
          <CommunityAnnouncementComposer
            initialChannelId={initialChannelId}
            lockChannel={lockChannel}
            onPublished={onDismiss}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

type CommunityGroupsFabProps = {
  onPress: () => void;
  disabled?: boolean;
  bottomOffset?: number;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel?: string;
};

export function CommunityGroupsFab({
  onPress,
  disabled = false,
  bottomOffset = 0,
  icon = 'megaphone',
  accessibilityLabel = 'Post announcement',
}: CommunityGroupsFabProps) {
  const { colors, inset } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: colors.accent.default,
          bottom: inset.lg + bottomOffset,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          right: inset.lg,
          shadowColor: colors.text.primary,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.accent.onAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  closeButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  fab: {
    alignItems: 'center',
    borderRadius: 999,
    elevation: 6,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    width: 56,
    zIndex: 20,
  },
});
