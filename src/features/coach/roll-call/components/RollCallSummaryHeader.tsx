import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassNavChrome } from '@/features/home/components/navigation/GlassNavChrome';
import { NAV_CHROME, UAE } from '@/features/home/components/navigation/uaeChrome';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type Props = {
  subtitle: string;
  topInset: number;
  onBackPress: () => void;
  onMenuPress?: () => void;
  showMenu?: boolean;
};

export const RollCallSummaryHeader = memo(function RollCallSummaryHeader({
  subtitle,
  topInset,
  onBackPress,
  onMenuPress,
  showMenu = true,
}: Props) {
  const { typography } = useTheme();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          top: topInset + NAV_CHROME.topInset,
        },
      ]}
    >
      <GlassNavChrome
        onPress={() => {
          triggerLightImpact();
          onBackPress();
        }}
        accessibilityLabel="Go back"
        style={styles.backCluster}
        contentStyle={styles.backClusterContent}
      >
        <Ionicons name="chevron-back" size={NAV_CHROME.iconSize} color={UAE.ink} />
      </GlassNavChrome>

      <GlassNavChrome
        accessibilityLabel="Roll call summary"
        style={styles.titleCapsule}
        contentStyle={styles.titleCapsuleContent}
      >
        <View style={styles.titleBlock}>
          <Text
            numberOfLines={1}
            style={[typography.textPresets.bodyStrong, styles.title, { color: UAE.ink }]}
          >
            Roll call summary
          </Text>
          <Text
            numberOfLines={1}
            style={[typography.textPresets.captionMedium, styles.subtitle, { color: UAE.inkMuted }]}
          >
            {subtitle}
          </Text>
        </View>

        {showMenu && onMenuPress ? (
          <>
            <View style={styles.divider} />
            <Pressable
              onPress={() => {
                triggerLightImpact();
                onMenuPress();
              }}
              accessibilityRole="button"
              accessibilityLabel="More actions"
              hitSlop={4}
              style={({ pressed }) => [styles.menuCell, pressed && styles.pressed]}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={UAE.ink} />
            </Pressable>
          </>
        ) : null}
      </GlassNavChrome>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: NAV_CHROME.containerSpacing,
    left: NAV_CHROME.horizontalInset,
    position: 'absolute',
    right: NAV_CHROME.horizontalInset,
    zIndex: 1000,
  },
  backCluster: {
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  backClusterContent: {
    flex: 1,
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  titleCapsule: {
    flex: 1,
    minHeight: NAV_CHROME.clusterHeight,
  },
  titleCapsuleContent: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: NAV_CHROME.clusterHeight,
    paddingLeft: 16,
    paddingRight: 6,
  },
  titleBlock: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingRight: 4,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 2,
    textAlign: 'center',
  },
  divider: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    height: 30,
    marginHorizontal: 8,
    width: StyleSheet.hairlineWidth,
  },
  menuCell: {
    alignItems: 'center',
    height: NAV_CHROME.clusterHeight,
    justifyContent: 'center',
    width: 40,
  },
  pressed: {
    opacity: 0.7,
  },
});
