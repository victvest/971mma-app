import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, radii } from '@/shared/theme';

type SkeletonRectProps = {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonRect({
  width = '100%',
  height,
  borderRadius,
  style,
}: SkeletonRectProps) {
  const { mode } = useTheme();
  const resolvedRadius = borderRadius ?? radii.sm;
  const baseColor = mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: resolvedRadius,
          backgroundColor: baseColor,
        },
        style,
      ]}
    />
  );
}

type SkeletonCircleProps = {
  size: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonCircle({ size, style }: SkeletonCircleProps) {
  return (
    <SkeletonRect
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
    />
  );
}

type SkeletonLoaderProps = {
  isLoaded: boolean;
  template: React.ReactNode;
  children: React.ReactNode;
};

export function SkeletonLoader({ isLoaded, template, children }: SkeletonLoaderProps) {
  return <>{isLoaded ? children : template}</>;
}
