import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';

import { GlassNavChrome } from '@/features/home/components/navigation/GlassNavChrome';
import { NAV_CHROME, UAE } from '@/features/home/components/navigation/uaeChrome';
import { triggerLightImpact } from '@/shared/haptics';
import { BrandedLucideIconBadge, Button, type BrandedIconTone } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';
import { inset, layout } from '@/shared/theme/spacing';

const AnimatedCounterText = Animated.createAnimatedComponent(TextInput);

export const PROFILE_HERO_HEIGHT = 320;

/** Extra scroll past the account footer (safe area added separately). */
export const PROFILE_SCROLL_BOTTOM_EXTRA = layout.tabBarHeight + inset['3xl'];

export function profileScrollContentPadding(
  safeBottom: number,
  horizontal: number,
  verticalGap: number,
) {
  return {
    paddingHorizontal: horizontal,
    paddingBottom: safeBottom + PROFILE_SCROLL_BOTTOM_EXTRA,
    gap: verticalGap,
  };
}

export function AnimatedCounter({
  value,
  style,
}: {
  value: number;
  style?: object;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    if (value === 0) return;
    progress.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, value]);

  const animatedProps = useAnimatedProps(() => {
    const eased = 1 - Math.pow(1 - progress.value, 3);
    const display = Math.round(eased * value);
    return { text: display.toLocaleString('en-US'), defaultValue: display.toLocaleString('en-US') };
  });

  return (
    <AnimatedCounterText
      editable={false}
      pointerEvents="none"
      style={[profileScreenStyles.statValueInput, style]}
      animatedProps={animatedProps}
    />
  );
}

export function SpringPressable({
  onPress,
  children,
  style,
  disabled,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: object;
  disabled?: boolean;
}) {
  const pressed = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.95]) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        triggerLightImpact();
        pressed.value = withSpring(1, { damping: 20, stiffness: 400, mass: 0.7 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { damping: 18, stiffness: 300, mass: 0.8 });
      }}
      disabled={disabled}
      style={style}
    >
      <Animated.View style={pressStyle}>{children}</Animated.View>
    </Pressable>
  );
}

export function useSectionEntrance(delayMs: number, enabled: boolean) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(36);

  useEffect(() => {
    if (!enabled) return;
    opacity.value = withDelay(
      delayMs,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      delayMs,
      withSpring(0, { damping: 22, stiffness: 200, mass: 0.9 }),
    );
    // opacity / translateY are stable refs — intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, delayMs]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

type StatCardProps = {
  value: number;
  label: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  labelColor: string;
  borderColor: string;
  cardRadius: number;
  iconName: keyof typeof Ionicons.glyphMap;
};

export const StatCard = React.memo(function StatCard({
  value,
  label,
  accentColor,
  bgColor,
  textColor,
  labelColor,
  borderColor,
  cardRadius,
  iconName,
}: StatCardProps) {
  const { shadows } = useTheme();
  const pressed = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.94]) }],
  }));

  return (
    <Pressable
      style={profileScreenStyles.statCardTouchable}
      onPressIn={() => {
        triggerLightImpact();
        pressed.value = withSpring(1, { damping: 20, stiffness: 400 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { damping: 18, stiffness: 280 });
      }}
    >
      <Animated.View
        style={[
          pressStyle,
          profileScreenStyles.statCard,
          shadows.card,
          {
            backgroundColor: bgColor,
            borderColor,
            borderWidth: 1,
            borderRadius: cardRadius,
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0)']}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 32,
            borderTopLeftRadius: cardRadius,
            borderTopRightRadius: cardRadius,
          }}
          pointerEvents="none"
        />
        <View style={[profileScreenStyles.statIconBubble, { backgroundColor: `${accentColor}18` }]}>
          <Ionicons name={iconName} size={16} color={accentColor} />
        </View>
        <AnimatedCounter value={value} style={[profileScreenStyles.statValue, { color: textColor }]} />
        <Text style={[profileScreenStyles.statLabel, { color: labelColor }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
});

type ProfileAccountFooterProps = {
  versionLabel: string;
  onEditProfile?: () => void;
  onSignOut: () => void;
  onChangePassword: () => void;
  onRequestDeletion?: () => void;
  showDeleteAccount?: boolean;
  onSwitchToMemberMode?: () => void;
};

type ProfileGlassHeaderProps = {
  safeTop: number;
  onBackPress: () => void;
  onEditPress?: () => void;
  title?: string;
};

export function ProfileGlassHeader({
  safeTop,
  onBackPress,
  onEditPress,
  title = 'Profile',
}: ProfileGlassHeaderProps) {
  const { typography } = useTheme();

  return (
    <View
      style={[
        profileLayoutStyles.headerRoot,
        {
          top: safeTop + NAV_CHROME.topInset,
        },
      ]}
      pointerEvents="box-none"
    >
      <GlassNavChrome
        onPress={onBackPress}
        accessibilityLabel="Go back"
        style={profileLayoutStyles.headerSoloCluster}
        contentStyle={profileLayoutStyles.headerSoloContent}
      >
        <Ionicons name="chevron-back" size={NAV_CHROME.iconSize} color={UAE.ink} />
      </GlassNavChrome>

      <GlassNavChrome
        accessibilityLabel="Profile actions"
        layout="bar"
        style={profileLayoutStyles.headerActionCapsule}
        contentStyle={[
          profileLayoutStyles.headerActionCapsuleContent,
          !onEditPress && { paddingRight: 16 },
        ]}
        borderRadius={NAV_CHROME.glassRadius}
      >
        <View style={profileLayoutStyles.headerTitleWrapper}>
          <Text style={[typography.textPresets.bodyStrong, { color: UAE.ink, fontWeight: '700' }]}>
            {title}
          </Text>
        </View>

        {onEditPress ? (
          <>
            <View style={profileLayoutStyles.headerActionDivider} />
            <Pressable
              onPress={onEditPress}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              hitSlop={4}
              style={({ pressed }) => [
                profileLayoutStyles.headerActionCell,
                pressed && profileLayoutStyles.headerPressed,
              ]}
            >
              <Ionicons name="create-outline" size={24} color={UAE.ink} />
            </Pressable>
          </>
        ) : null}
      </GlassNavChrome>
    </View>
  );
}

type ProfilePerfMetricCardProps = {
  label: string;
  value: string | number;
  subtitle: string;
  iconName: keyof typeof Ionicons.glyphMap;
  valueColor?: string;
  textColor: string;
  secondaryTextColor: string;
};

export const ProfilePerfMetricCard = React.memo(function ProfilePerfMetricCard({
  label,
  value,
  subtitle,
  iconName,
  valueColor,
  textColor,
  secondaryTextColor,
}: ProfilePerfMetricCardProps) {
  return (
    <View style={profileLayoutStyles.cardWrapper}>
      <View style={profileLayoutStyles.watermarkContainer}>
        <Ionicons
          name={iconName}
          size={80}
          color="#000000"
          style={{ opacity: 0.07, transform: [{ rotate: '-12deg' }] }}
        />
      </View>

      <View style={profileLayoutStyles.perfCardHeader}>
        <Text style={[profileLayoutStyles.perfCardLabel, { color: secondaryTextColor }]}>
          {label}
        </Text>
      </View>

      <Text style={[profileLayoutStyles.perfCardValue, { color: valueColor ?? textColor }]}>
        {value}
      </Text>

      <Text style={[profileLayoutStyles.perfCardSub, { color: secondaryTextColor }]}>
        {subtitle}
      </Text>
    </View>
  );
});

type ProfileActionTileProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  iconTone?: BrandedIconTone;
  showDivider?: boolean;
};

export const ProfileActionTile = React.memo(function ProfileActionTile({
  icon,
  title,
  subtitle,
  onPress,
  iconTone = 'neutral',
  showDivider = false,
}: ProfileActionTileProps) {
  const { colors, typography, inset, mode } = useTheme();
  const mutedBorder = mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        profileLayoutStyles.actionTile,
        showDivider && {
          borderBottomColor: mutedBorder,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        {
          paddingHorizontal: inset.md,
          paddingVertical: inset.sm + 4,
          backgroundColor: pressed ? colors.fill.secondary : colors.surface.primary,
        },
      ]}
    >
      <BrandedLucideIconBadge icon={icon} tone={iconTone} />

      <View style={profileLayoutStyles.actionTextCol}>
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
          {title}
        </Text>
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
          {subtitle}
        </Text>
      </View>

      <ChevronRight size={16} color={colors.text.tertiary} strokeWidth={2.25} />
    </Pressable>
  );
});

export function ProfileAccountFooter({
  versionLabel,
  onEditProfile,
  onSignOut,
  onChangePassword,
  onRequestDeletion,
  showDeleteAccount = false,
  onSwitchToMemberMode,
}: ProfileAccountFooterProps) {
  const { colors, typography } = useTheme();

  return (
    <View style={profileScreenStyles.accountFooter}>
      {onEditProfile ? (
        <Button label="Edit profile" variant="secondary" icon="create-outline" onPress={onEditProfile} />
      ) : null}
      {onSwitchToMemberMode ? (
        <Button
          label="Switch to member mode"
          variant="secondary"
          icon="person-outline"
          onPress={onSwitchToMemberMode}
        />
      ) : null}
      <Button label="Change password" variant="secondary" onPress={onChangePassword} />
      <Button label="Sign out" variant="outline" onPress={onSignOut} />

      {showDeleteAccount && onRequestDeletion ? (
        <Pressable
          onPress={onRequestDeletion}
          accessibilityRole="button"
          accessibilityLabel="Request account deletion"
          hitSlop={8}
        >
          <Text
            style={[
              typography.textPresets.footnote,
              profileScreenStyles.deleteAccountText,
              { color: colors.text.tertiary },
            ]}
          >
            Request account deletion
          </Text>
        </Pressable>
      ) : null}

      <Text style={[typography.textPresets.caption, profileScreenStyles.versionText, { color: colors.text.tertiary }]}>
        {versionLabel}
      </Text>
    </View>
  );
}

export const profileScreenStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  stateCenter: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroSection: {
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  heroKickerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 4,
  },
  heroKickerText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '900',
  },
  identityText: {
    flex: 1,
    gap: 2,
    paddingBottom: 2,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  heroRole: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'capitalize',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  heroMetaChip: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
  },
  heroEmail: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    marginTop: 1,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  statsGrid: {
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCardTouchable: {
    flex: 1,
  },
  statCard: {
    flex: 1,
    padding: 16,
    gap: 4,
    position: 'relative',
  },
  statIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  statValue: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  statValueInput: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 38,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  promoCard: {
    borderWidth: 1,
  },
  accentBar: {
    height: 3,
  },
  promoCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  promoInfoCol: {
    flex: 1,
    gap: 3,
    paddingRight: 16,
  },
  promoKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  promoKicker: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  promoTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  promoSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  disciplineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountFooter: {
    alignItems: 'stretch',
    gap: 16,
    paddingTop: 8,
  },
  deleteAccountText: {
    textAlign: 'center',
  },
  versionText: {
    textAlign: 'center',
  },
});

export const profileLayoutStyles = StyleSheet.create({
  headerRoot: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    left: NAV_CHROME.horizontalInset,
    right: NAV_CHROME.horizontalInset,
    zIndex: 1000,
  },
  headerSoloCluster: {
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  headerSoloContent: {
    flex: 1,
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  headerActionCapsule: {
    minHeight: NAV_CHROME.clusterHeight,
  },
  headerActionCapsuleContent: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: NAV_CHROME.clusterHeight,
    paddingLeft: 16,
    paddingRight: 6,
  },
  headerTitleWrapper: {
    justifyContent: 'center',
    paddingRight: 4,
  },
  headerActionDivider: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    height: 30,
    marginHorizontal: 8,
    width: StyleSheet.hairlineWidth,
  },
  headerActionCell: {
    alignItems: 'center',
    height: NAV_CHROME.clusterHeight,
    justifyContent: 'center',
    width: 40,
  },
  headerPressed: {
    opacity: 0.7,
  },
  identityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  avatarGlowContainer: {
    alignSelf: 'center',
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  centeredName: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  memberSinceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  memberSinceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionContainer: {
    width: '100%',
    marginBottom: 12,
  },
  perfCardsGrid: {
    width: '100%',
  },
  perfCardsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 0,
  },
  cardWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 0,
  },
  watermarkContainer: {
    position: 'absolute',
    bottom: -15,
    right: -15,
    zIndex: 0,
  },
  perfCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 1,
  },
  perfCardLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  perfCardValue: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 4,
    zIndex: 1,
  },
  perfCardSub: {
    fontSize: 12,
    fontWeight: '500',
    zIndex: 1,
  },
  actionGroup: {
    overflow: 'hidden',
    width: '100%',
  },
  actionTile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  actionTextCol: {
    flex: 1,
    gap: 2,
    paddingRight: 8,
  },
});
