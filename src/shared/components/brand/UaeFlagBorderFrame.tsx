import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '@/shared/theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type Props = {
  borderRadius: number;
  borderWidth?: number;
};

type Size = {
  width: number;
  height: number;
};

type BorderSegmentProps = {
  index: number;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  ry: number;
  borderWidth: number;
  segmentLength: number;
  dashGap: number;
  rotation: SharedValue<number>;
};

function roundedRectPerimeter(width: number, height: number, cornerRadius: number) {
  const radius = Math.min(cornerRadius, width / 2, height / 2);
  return 2 * (width + height) - 8 * radius + 2 * Math.PI * radius;
}

function FlagBorderSegment({
  index,
  color,
  x,
  y,
  width,
  height,
  rx,
  ry,
  borderWidth,
  segmentLength,
  dashGap,
  rotation,
}: BorderSegmentProps) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: -index * segmentLength - rotation.value,
  }));

  return (
    <AnimatedRect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={rx}
      ry={ry}
      fill="none"
      stroke={color}
      strokeWidth={borderWidth}
      strokeDasharray={`${segmentLength} ${dashGap}`}
      animatedProps={animatedProps}
    />
  );
}

/** Continuous UAE flag-color ring around a rounded rect — glass background stays underneath. */
export function UaeFlagBorderFrame({ borderRadius, borderWidth = 1 }: Props) {
  const { colors } = useTheme();
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const rotation = useSharedValue(0);

  const segmentColors = useMemo(
    () => [colors.accent.default, colors.fill.primary, colors.status.error],
    [colors.accent.default, colors.fill.primary, colors.status.error],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  }, []);

  const halfStroke = borderWidth / 2;
  const rectWidth = Math.max(0, size.width - borderWidth);
  const rectHeight = Math.max(0, size.height - borderWidth);
  const cornerRadius = Math.max(0, borderRadius - halfStroke);
  const perimeter =
    size.width > 0 && size.height > 0
      ? roundedRectPerimeter(rectWidth, rectHeight, cornerRadius)
      : 0;
  const segmentLength = perimeter / segmentColors.length;
  const dashGap = perimeter - segmentLength;

  useEffect(() => {
    if (perimeter <= 0) {
      return;
    }

    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(perimeter, { duration: 5000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [perimeter, rotation]);

  if (size.width === 0 || size.height === 0) {
    return (
      <View
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        onLayout={handleLayout}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={handleLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size.width} height={size.height}>
        {segmentColors.map((color, index) => (
          <FlagBorderSegment
            key={index}
            index={index}
            color={color}
            x={halfStroke}
            y={halfStroke}
            width={rectWidth}
            height={rectHeight}
            rx={cornerRadius}
            ry={cornerRadius}
            borderWidth={borderWidth}
            segmentLength={segmentLength}
            dashGap={dashGap}
            rotation={rotation}
          />
        ))}
      </Svg>
    </View>
  );
}
