import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  CheckInModeToggle,
  type CheckInMode,
} from '@/features/checkin/components/CheckInModeToggle';
import { EntranceScanner } from '@/features/checkin/components/EntranceScanner';
import { FamilyQrPager } from '@/features/checkin/components/FamilyQrPager';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';

type Props = {
  tabFocused: boolean;
  checkedInToday: boolean;
  checkedInAt?: string | null;
  token: string | null | undefined;
  passLoading: boolean;
  memberName: string;
  beltLine: string;
  canShowActiveQr: boolean;
  planName?: string | null;
  expiryDate?: string | null;
  onModeChange?: (mode: CheckInMode) => void;
  isGuest?: boolean;
  isRegistered?: boolean;
};

export function CheckInEntranceSection({
  tabFocused,
  checkedInToday,
  checkedInAt,
  token,
  passLoading,
  memberName,
  beltLine,
  canShowActiveQr,
  planName,
  expiryDate,
  onModeChange,
  isGuest = false,
  isRegistered = false,
}: Props) {
  const { gap } = useTheme();
  const [mode, setMode] = useState<CheckInMode>('pass');
  const [shellHeight, setShellHeight] = useState(0);

  useEffect(() => {
    if (checkedInToday) {
      setMode('pass');
    }
  }, [checkedInToday]);

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  const handleShellContentLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setShellHeight((current) => (height > current ? height : current));
  }, []);

  const passOpacity = useSharedValue(mode === 'pass' ? 1 : 0);
  const scanOpacity = useSharedValue(mode === 'scan' ? 1 : 0);

  useEffect(() => {
    passOpacity.value = withTiming(mode === 'pass' ? 1 : 0, animations.timing.fade);
    scanOpacity.value = withTiming(mode === 'scan' ? 1 : 0, animations.timing.fade);
  }, [mode, passOpacity, scanOpacity]);

  const passStyle = useAnimatedStyle(() => ({
    opacity: passOpacity.value,
  }));

  const scanStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity.value,
  }));

  const handleModeChange = useCallback((next: CheckInMode) => {
    setMode(next);
  }, []);

  return (
    <View style={{ gap: gap.md }}>
      {canShowActiveQr ? (
        <CheckInModeToggle mode={mode} onModeChange={handleModeChange} />
      ) : null}

      <View style={[styles.shell, shellHeight > 0 ? { height: shellHeight } : null]}>
        <Animated.View
          pointerEvents={mode === 'pass' ? 'auto' : 'none'}
          style={[styles.layer, passStyle]}
        >
          <View onLayout={handleShellContentLayout}>
            <FamilyQrPager
              token={token}
              loading={passLoading}
              checkedInToday={checkedInToday}
              memberName={memberName}
              beltLine={beltLine}
              canShowActiveQr={canShowActiveQr}
              planName={planName}
              expiryDate={expiryDate}
              isGuest={isGuest}
              isRegistered={isRegistered}
            />
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents={mode === 'scan' ? 'auto' : 'none'}
          style={[styles.layer, scanStyle]}
        >
          {mode === 'scan' ? (
            <View onLayout={handleShellContentLayout}>
              <EntranceScanner
                tabFocused={tabFocused}
                checkedInToday={checkedInToday}
                checkedInAt={checkedInAt}
                memberName={memberName}
                canShowActiveQr={canShowActiveQr}
              />
            </View>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 420,
  },
  layer: {
    ...StyleSheet.absoluteFill,
  },
});
