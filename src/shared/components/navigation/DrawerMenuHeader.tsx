import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import drawerBrandMark from '../../../../assets/brand/logo-notext.png';

type Props = {
  onClose: () => void;
};

export function DrawerMenuHeader({ onClose }: Props) {
  const { colors, typography, radius, layout, animations } = useTheme();
  const logoSize = Math.round(layout.appHeaderIconTouch * 0.62);

  return (
    <View style={styles.header}>
      <Image
        source={drawerBrandMark}
        contentFit="contain"
        cachePolicy="memory-disk"
        accessibilityLabel="971 MMA"
        style={{
          width: logoSize,
          height: logoSize,
          tintColor: colors.text.primary,
        }}
      />

      <Pressable
        onPressIn={triggerLightImpact}
        onPress={onClose}
        accessibilityLabel="Close navigation menu"
        style={({ pressed }) => [
          styles.closeBtn,
          {
            width: layout.appHeaderIconTouch,
            height: layout.appHeaderIconTouch,
            borderRadius: radius.pill,
            backgroundColor: colors.surface.primary,
            opacity: pressed ? animations.alpha.pressed : animations.alpha.visible,
          },
        ]}
      >
        <Ionicons name="close" size={typography.fontSize.lg} color={colors.text.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
