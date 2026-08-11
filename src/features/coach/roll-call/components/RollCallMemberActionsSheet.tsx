import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppBottomSheet, AppBottomSheetButton } from '@/shared/components/AppBottomSheet';
import { useTheme } from '@/shared/theme';

type Props = {
  visible: boolean;
  memberName: string;
  isRemoving?: boolean;
  onDismiss: () => void;
  onRemove: () => void;
};

export const RollCallMemberActionsSheet = memo(function RollCallMemberActionsSheet({
  visible,
  memberName,
  isRemoving = false,
  onDismiss,
  onRemove,
}: Props) {
  const { colors, typography, gap, inset } = useTheme();
  const safeName = memberName.trim() || 'this member';

  return (
    <AppBottomSheet visible={visible} onDismiss={onDismiss} dismissOnBackdropPress={!isRemoving}>
      <View style={[styles.content, { gap: gap.md }]}>
        <Text
          style={[typography.textPresets.subtitle, { color: colors.text.primary, textAlign: 'center' }]}
        >
          {safeName}
        </Text>
        <Text
          style={[
            typography.textPresets.body,
            {
              color: colors.text.secondary,
              textAlign: 'center',
              paddingHorizontal: inset.sm,
            },
          ]}
        >
          Remove them from this class list. You can scan their QR again later to add them back.
        </Text>

        <View style={{ gap: gap.sm, paddingTop: inset.sm }}>
          <AppBottomSheetButton
            label={isRemoving ? 'Removing…' : 'Remove from class list'}
            variant="destructive"
            onPress={isRemoving ? () => undefined : onRemove}
          />
          <AppBottomSheetButton
            label="Cancel"
            variant="secondary"
            onPress={isRemoving ? () => undefined : onDismiss}
          />
        </View>
      </View>
    </AppBottomSheet>
  );
});

const styles = StyleSheet.create({
  content: {
    alignItems: 'stretch',
  },
});
