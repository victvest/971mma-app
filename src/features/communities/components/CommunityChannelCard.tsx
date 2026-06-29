import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '@/shared/theme';
import type { CommunityChannelItem } from '@/types/domain';

type CommunityChannelCardProps = {
  channel: CommunityChannelItem;
  onPress: () => void;
};

function formatRelativeDate(iso: string | null): string {
  if (!iso) return 'No posts yet';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recently active';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function CommunityChannelCard({ channel, onPress }: CommunityChannelCardProps) {
  const { colors, typography, inset, gap, radius, layout, shadows } = useTheme();
  const initial = channel.coachName.trim().slice(0, 1).toUpperCase() || 'C';
  const latestLabel = useMemo(() => formatRelativeDate(channel.latestPostAt), [channel.latestPostAt]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${channel.title}`}
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderRadius: radius.cardLarge,
          borderWidth: layout.borderWidth,
          padding: inset.md,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.headerRow}>
        {channel.coachAvatarUrl ? (
          <Image
            source={{ uri: channel.coachAvatarUrl }}
            style={[styles.avatar, { backgroundColor: colors.fill.secondary }]}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.fill.secondary }]}>
            <Text style={[styles.avatarText, { color: colors.text.secondary }]}>{initial}</Text>
          </View>
        )}

        <View style={styles.copy}>
          <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]} numberOfLines={1}>
            {channel.title}
          </Text>
          <Text style={[styles.subline, { color: colors.text.secondary }]} numberOfLines={1}>
            {channel.disciplineName} · {channel.coachName}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>

      {channel.description ? (
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]} numberOfLines={2}>
          {channel.description}
        </Text>
      ) : null}

      <View style={[styles.metaRow, { gap: gap.sm }]}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
          <Text style={[styles.metaText, { color: colors.text.tertiary }]}>{latestLabel}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={14} color={colors.text.tertiary} />
          <Text style={[styles.metaText, { color: colors.text.tertiary }]}>
            {channel.memberCount} member{channel.memberCount === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    width: '100%',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 44,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  subline: {
    fontSize: 13,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
