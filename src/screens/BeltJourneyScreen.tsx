import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, palette, radii, spacing, typography } from '../theme';
import { GlassNavBar } from '../components/GlassNavBar';
import { ScreenShell } from '../components/ScreenShell';
import { GlassSurface } from '../components/GlassSurface';
import { ProgressBar, SectionHeader } from '../components/primitives';
import { beltJourney } from '../data/memberFeatures';
import { useProfile } from '../hooks/useProfile';

export function BeltJourneyScreen() {
  const { profile } = useProfile();
  const rank = profile?.beltRank ?? beltJourney.rank;
  const stripes = profile?.beltStripes ?? beltJourney.stripes;

  return (
    <ScreenShell>
      <StatusBar style="dark" />
      <GlassNavBar title="Belt journey" subtitle="Progress · coach assessment" showBell={false} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GlassSurface strong tone="green">
          <View style={styles.rankHead}>
            <View style={styles.beltVisual}>
              <View style={styles.beltBody} />
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[styles.stripe, { opacity: i < stripes ? 1 : 0.2, left: 28 + i * 14 }]}
                />
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rankTitle}>{rank}</Text>
              <Text style={styles.rankSub}>{beltJourney.track} · {stripes} stripes</Text>
              <Text style={styles.rankNext}>Next: {beltJourney.nextMilestone}</Text>
            </View>
            <Text style={styles.rankPct}>{beltJourney.percent}%</Text>
          </View>
          <ProgressBar percent={beltJourney.percent} />
        </GlassSurface>

        <GlassSurface tone="gold" style={{ marginTop: spacing.lg }}>
          <View style={styles.coachHead}>
            <Ionicons name="school-outline" size={20} color={palette.goldDeep} />
            <Text style={styles.coachTitle}>Coach assessment scheduled</Text>
          </View>
          <Text style={styles.coachWhen}>{beltJourney.coachAssessment.date}</Text>
          <Text style={styles.coachMeta}>{beltJourney.coachAssessment.coach} · {beltJourney.coachAssessment.location}</Text>
          <Text style={styles.coachNote}>{beltJourney.coachNote}</Text>
        </GlassSurface>

        <View style={styles.section}>
          <SectionHeader title="Requirements" />
          <GlassSurface>
            {beltJourney.requirements.map((r, i) => (
              <View key={r.id} style={[styles.reqRow, i < beltJourney.requirements.length - 1 && styles.reqBorder]}>
                <Ionicons
                  name={r.done ? 'checkmark-circle' : r.coachSigned ? 'ellipse' : 'ellipse-outline'}
                  size={22}
                  color={r.done ? colors.accent : colors.textFaint}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reqText, !r.done && { color: colors.textMuted }]}>{r.label}</Text>
                  {r.coachSigned ? <Text style={styles.reqSigned}>Signed off by coach</Text> : null}
                </View>
              </View>
            ))}
          </GlassSurface>
          <Text style={styles.disclaimer}>
            Final promotion decisions are made by your coach after review on the mat.
          </Text>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Promotion history" />
          <View style={{ gap: spacing.sm }}>
            {beltJourney.history.map((h) => (
              <GlassSurface key={h.id} padding={spacing.lg}>
                <Text style={styles.histRank}>{h.rank}</Text>
                <Text style={styles.histMeta}>{h.date} · {h.coach}</Text>
                {h.note ? <Text style={styles.histNote}>{h.note}</Text> : null}
              </GlassSurface>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 132 },
  rankHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.lg },
  beltVisual: {
    width: 88,
    height: 28,
    justifyContent: 'center',
  },
  beltBody: {
    height: 16,
    borderRadius: 4,
    backgroundColor: '#F5F5F0',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  stripe: {
    position: 'absolute',
    top: 4,
    width: 8,
    height: 20,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  rankTitle: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text },
  rankSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rankNext: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint, marginTop: 4 },
  rankPct: { fontFamily: fonts.displayBlack, fontSize: 24, color: colors.accent },
  coachHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  coachTitle: { fontFamily: fonts.semi, fontSize: 15, color: colors.text },
  coachWhen: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginTop: spacing.md },
  coachMeta: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  coachNote: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, lineHeight: 20, marginTop: spacing.md },
  section: { marginTop: spacing.xxl },
  reqRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md },
  reqBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  reqText: { fontFamily: fonts.semi, fontSize: 14, color: colors.text },
  reqSigned: { fontFamily: fonts.medium, fontSize: 11, color: colors.accent, marginTop: 3 },
  disclaimer: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textFaint,
    marginTop: spacing.md,
    lineHeight: 18,
  },
  histRank: { fontFamily: fonts.semi, fontSize: 15, color: colors.text },
  histMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 4 },
  histNote: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 18 },
});
