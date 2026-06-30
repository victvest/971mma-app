import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AcademyEyebrow } from '@/shared/components/brand';
import {
  normalizeBeltRankKey,
  type BeltCurriculumAscentStop,
} from '@/features/belt/data/beltPathPreviewContent';
import { useTheme } from '@/shared/theme';

const RAIL_COLOR = '#E8E8E8';
const NODE_SIZE = 14;
const RAIL_WIDTH = 2;
const SWATCH_WIDTH = 52;
const SWATCH_HEIGHT = 8;

type Props = {
  currentRankName?: string | null;
  currentRankId?: string | null;
  stops: BeltCurriculumAscentStop[];
};

function BeltSwatch({ stop }: { stop: BeltCurriculumAscentStop }) {
  return (
    <View
      style={[
        styles.swatch,
        {
          backgroundColor: stop.beltColor,
          borderColor: stop.beltBorderColor ?? 'transparent',
          borderWidth: stop.beltBorderColor ? 1 : 0,
        },
      ]}
    >
      {stop.stripeColor ? (
        <View
          style={[
            styles.swatchStripe,
            {
              backgroundColor: stop.stripeColor,
              borderColor: stop.rankKey === 'white' ? stop.beltBorderColor : 'transparent',
              borderWidth: stop.rankKey === 'white' ? StyleSheet.hairlineWidth : 0,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const CurriculumStop = React.memo(function CurriculumStop({
  stop,
  isCurrent,
  isLast,
}: {
  stop: BeltCurriculumAscentStop;
  isCurrent: boolean;
  isLast: boolean;
}) {
  const { colors, typography, radius, inset, layout } = useTheme();

  return (
    <View style={[styles.stopRow, { marginBottom: isLast ? 0 : inset.sm }]}>
      <View style={styles.railColumn}>
        <View
          style={[
            styles.node,
            {
              backgroundColor: stop.nodeColor,
              borderColor: stop.nodeBorderColor ?? stop.nodeColor,
              borderWidth: stop.nodeBorderColor ? 1.5 : 0,
            },
          ]}
        />
      </View>

      <View
        style={[
          styles.stopCard,
          {
            backgroundColor: colors.surface.primary,
            borderColor: isCurrent ? colors.accent.default : RAIL_COLOR,
            borderRadius: radius.card,
            borderWidth: isCurrent ? 1.5 : layout.borderWidth,
            padding: inset.md,
          },
        ]}
      >
        {isCurrent ? (
          <Text style={[styles.currentRankLabel, { color: colors.accent.default }]}>
            CURRENT RANK
          </Text>
        ) : null}

        <BeltSwatch stop={stop} />

        <Text style={[typography.textPresets.bodyStrong, styles.rankName, { color: colors.text.primary }]}>
          {stop.rank}
        </Text>
        <Text
          style={[typography.textPresets.footnote, styles.summary, { color: colors.text.secondary }]}
          numberOfLines={1}
        >
          {stop.summary}
        </Text>
        <Text style={[typography.textPresets.caption, styles.stripesCaption, { color: colors.text.tertiary }]}>
          {stop.stripes} stripes per rank
        </Text>
      </View>
    </View>
  );
});

export function CurriculumAscentModule({
  currentRankName,
  currentRankId,
  stops,
}: Props) {
  const { colors, typography, gap, inset } = useTheme();
  const currentRankKey = normalizeBeltRankKey(currentRankName);

  if (stops.length === 0) {
    return null;
  }

  return (
    <View style={[styles.module, { gap: gap.md, marginBottom: gap.lg }]}>
      <View style={{ gap: gap.xs }}>
        <AcademyEyebrow label="Curriculum" accent showFlag={false} />
        <Text style={[typography.textPresets.title, styles.moduleTitle, { color: colors.text.primary }]}>
          The ascent
        </Text>
        <Text style={[typography.textPresets.body, { color: colors.text.secondary, lineHeight: 22 }]}>
          Academy curriculum from first class to black belt.
        </Text>
      </View>

      <View style={[styles.journey, { paddingLeft: inset.xs }]}>
        <View
          style={[
            styles.railLine,
            {
              top: NODE_SIZE / 2,
              bottom: NODE_SIZE / 2,
            },
          ]}
        />
        {stops.map((stop, index) => (
          <CurriculumStop
            key={stop.id}
            stop={stop}
            isCurrent={
              (currentRankId != null && stop.id === currentRankId) ||
              (currentRankId == null && stop.rankKey === currentRankKey)
            }
            isLast={index === stops.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  module: {},
  moduleTitle: {
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  journey: {
    position: 'relative',
  },
  railLine: {
    backgroundColor: RAIL_COLOR,
    left: 13,
    position: 'absolute',
    width: RAIL_WIDTH,
  },
  stopRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  railColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    zIndex: 1,
  },
  stopCard: {
    flex: 1,
    gap: 8,
  },
  currentRankLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  swatch: {
    width: SWATCH_WIDTH,
    height: SWATCH_HEIGHT,
    borderRadius: SWATCH_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swatchStripe: {
    width: 14,
    height: SWATCH_HEIGHT,
  },
  rankName: {
    letterSpacing: -0.2,
  },
  summary: {
    lineHeight: 18,
  },
  stripesCaption: {
    letterSpacing: 0.1,
  },
});
