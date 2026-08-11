import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { useTheme } from '@/shared/theme';
import { VerifiedCoachBadge } from './VerifiedCoachBadge';

type Props = {
  name: string;
  avatarUrl?: string | null;
  size: number;
  showCoachBadge?: boolean;
  backgroundColor?: string;
  textColor?: string;
};

/**
 * Member avatar with optional verified-coach mark overlaid at the bottom-right.
 * Keeps the badge outside MemberAvatar's clipped shell so it reads clearly.
 */
export const MemberAvatarWithCoachBadge = memo(function MemberAvatarWithCoachBadge({
  name,
  avatarUrl,
  size,
  showCoachBadge = false,
  backgroundColor,
  textColor,
}: Props) {
  const { colors } = useTheme();
  const badgeSize = Math.max(14, Math.round(size * 0.38));
  const ring = Math.max(2, Math.round(size * 0.045));

  return (
    <View style={{ width: size, height: size }}>
      <MemberAvatar
        name={name}
        avatarUrl={avatarUrl}
        size={size}
        backgroundColor={backgroundColor}
        textColor={textColor}
      />
      {showCoachBadge ? (
        <View
          pointerEvents="none"
          style={[
            styles.badgeWrap,
            {
              borderColor: colors.surface.primary,
              borderWidth: ring,
              borderRadius: (badgeSize + ring * 2) / 2,
              bottom: -ring,
              right: -ring,
            },
          ]}
        >
          <VerifiedCoachBadge size={badgeSize} />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  badgeWrap: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
