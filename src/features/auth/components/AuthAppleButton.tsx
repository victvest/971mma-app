import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/shared/theme';
import { AppleLogo } from '@/features/auth/components/AppleLogo';
import { isAppleAuthAvailable } from '@/features/auth/services/appleAuth';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type AuthAppleButtonProps = {
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function AuthAppleButton({ onPress, loading, disabled }: AuthAppleButtonProps) {
  const { typography, inset, gap, layout, radius, animations } = useTheme();
  const scale = useSharedValue<number>(animations.scale.resting);
  const [pressed, setPressed] = useState(false);
  const [available, setAvailable] = useState(Platform.OS === 'ios');
  const inactive = disabled || loading;
  const foreground = '#FFFFFF';
  const backgroundColor = inactive ? '#3A3A3A' : pressed ? '#1A1A1A' : '#000000';

  useEffect(() => {
    let mounted = true;

    void isAppleAuthAvailable().then((isAvailable) => {
      if (mounted) setAvailable(isAvailable);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (Platform.OS !== 'ios' || !available) {
    return null;
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Apple"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => {
        if (!inactive) {
          setPressed(true);
          scale.value = withSpring(animations.scale.pressed, animations.spring.snappy);
        }
      }}
      onPressOut={() => {
        setPressed(false);
        scale.value = withSpring(animations.scale.resting, animations.spring.snappy);
      }}
      style={[
        styles.button,
        {
          minHeight: layout.authButtonHeight,
          paddingHorizontal: inset.lg,
          borderRadius: radius.button,
          backgroundColor,
          gap: gap.sm,
        },
        buttonStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <View style={[styles.content, { gap: gap.sm }]}>
          <AppleLogo size={20} color={foreground} />
          <Text
            style={{
              ...typography.textPresets.button,
              fontSize: 16,
              fontWeight: '800',
              color: foreground,
            }}
          >
            Continue with Apple
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
