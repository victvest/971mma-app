import React from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';

const logoBlack = require('../../assets/brand/971-logo-black.png');

type Props = {
  size?: number;
  tint?: 'black' | 'white' | 'none';
  style?: StyleProp<ViewStyle>;
};

export function Logo({ size = 40, tint = 'black', style }: Props) {
  const imgStyle: ImageStyle = {
    width: size,
    height: size,
    resizeMode: 'contain',
  };
  if (tint === 'white') imgStyle.tintColor = '#FFFFFF';
  if (tint === 'black') imgStyle.tintColor = '#0B0B0C';

  return (
    <View style={style}>
      <Image source={logoBlack} style={imgStyle} />
    </View>
  );
}
