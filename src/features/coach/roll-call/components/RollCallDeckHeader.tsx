import React, { memo } from 'react';
import { View } from 'react-native';
import { AppBar, AppBarIconButton } from '@/shared/components/ui';
import { triggerLightImpact } from '@/shared/haptics';

type Props = {
  classTitle: string;
  onBackPress: () => void;
  /**
   * QR scan when the class list is empty (or review). Hidden while actively
   * swiping so the more-menu owns the right slot for the current member.
   */
  showScan?: boolean;
  onScanPress?: () => void;
  /** Opens member actions for the current top-of-deck card. */
  showMemberMenu?: boolean;
  onMemberMenuPress?: () => void;
};

export const RollCallDeckHeader = memo(function RollCallDeckHeader({
  classTitle,
  onBackPress,
  showScan = false,
  onScanPress,
  showMemberMenu = false,
  onMemberMenuPress,
}: Props) {
  const rightElement = showMemberMenu ? (
    <AppBarIconButton
      icon="ellipsis-horizontal"
      accessibilityLabel="Member options"
      onPress={() => {
        triggerLightImpact();
        onMemberMenuPress?.();
      }}
    />
  ) : showScan && onScanPress ? (
    <AppBarIconButton
      icon="qr-code-outline"
      accessibilityLabel="Scan member QR"
      onPress={() => {
        triggerLightImpact();
        onScanPress();
      }}
    />
  ) : undefined;

  return (
    <View>
      <AppBar
        title={classTitle}
        showBackButton
        onBackPress={onBackPress}
        rightElement={rightElement}
        titleNumberOfLines={2}
      />
    </View>
  );
});
