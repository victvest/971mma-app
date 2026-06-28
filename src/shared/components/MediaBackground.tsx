import React, { type ReactNode } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

type MediaBackgroundProps = {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  children: ReactNode;
};

/**
 * expo-image replacement for React Native ImageBackground — same layering, better caching/decode.
 */
export function MediaBackground({ source, style, borderRadius, children }: MediaBackgroundProps) {
  return (
    <View style={[style, borderRadius != null && { borderRadius, overflow: 'hidden' }]}>
      <Image
        source={source}
        style={[StyleSheet.absoluteFill, borderRadius != null && { borderRadius }]}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      {children}
    </View>
  );
}
