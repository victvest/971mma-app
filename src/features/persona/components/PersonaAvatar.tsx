import React, { memo } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { personaAssets } from '../assets';

type Props = {
  size: number;
  style?: StyleProp<ViewStyle>;
  showRing?: boolean;
};

export const PersonaAvatar = memo(function PersonaAvatar({ size, style, showRing = false }: Props) {
  const radius = size / 2;

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
        showRing ? styles.ring : null,
        style,
      ]}
    >
      <Image
        source={personaAssets.portrait}
        style={[
          styles.portrait,
          {
            width: size * 1.18,
            height: size * 1.28,
            marginTop: -size * 0.06,
            marginLeft: -size * 0.09,
          },
        ]}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#0A0A0A',
    overflow: 'hidden',
  },
  ring: {
    borderColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1.5,
  },
  portrait: {
    position: 'absolute',
  },
});
