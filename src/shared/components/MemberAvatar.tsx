import React, { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { getInitials } from '@/shared/utils/getInitials';

type MemberAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  /** Outer width/height of the avatar shell (border included). */
  size: number;
  style?: StyleProp<ViewStyle>;
  borderWidth?: number;
  borderColor?: string;
  backgroundColor?: string;
  textColor?: string;
  initialsStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
};

export function MemberAvatar({
  name,
  avatarUrl,
  size,
  style,
  borderWidth = 0,
  borderColor,
  backgroundColor,
  textColor,
  initialsStyle,
  children,
}: MemberAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  const handleImageError = useCallback(() => {
    setImageFailed(true);
  }, []);

  const showImage = Boolean(avatarUrl) && !imageFailed;
  const innerSize = Math.max(0, size - borderWidth * 2);
  const borderRadius = size / 2;

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius,
          borderWidth,
          borderColor,
          backgroundColor: showImage ? undefined : backgroundColor,
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: avatarUrl! }}
          style={[styles.image, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
          onError={handleImageError}
        />
      ) : (
        <>
          <Text style={[styles.initials, { color: textColor }, initialsStyle]}>
            {getInitials(name)}
          </Text>
          {children}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    flexShrink: 0,
  },
  initials: {
    fontSize: 14,
    fontWeight: '800',
  },
});
