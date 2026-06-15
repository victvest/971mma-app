import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Icon, Text } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, fonts, palette, spacing } from '../theme';
import { AcademyHeader } from '../components/AcademyHeader';
import { ScreenShell } from '../components/ScreenShell';
import { UaeFlagIcon } from '../components/UaeFlagIcon';
import { GlassCard, InkButton } from '../ui';
import { coachProfiles } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import type { TabsParamList } from '../navigation/types';

function firstName(email?: string | null, full?: string) {
  if (full) return full.split(' ')[0];
  if (!email) return 'Athlete';
  return email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

export function CoachesScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const tabNav = useNavigation<BottomTabNavigationProp<TabsParamList, 'Coaches'>>();
  const name = firstName(user?.email, profile?.fullName || (user?.user_metadata as any)?.full_name);
  const lead = coachProfiles[0];

  return (
    <ScreenShell>
      <StatusBar style="dark" />
      <AcademyHeader memberName={name} initials={initials(name)} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GlassCard style={styles.lineageCard}>
          <View style={styles.lineageRow}>
            <UaeFlagIcon />
            <View style={{ flex: 1 }}>
              <Text style={styles.lineageLbl}>BELT & LINEAGE</Text>
              <Text variant="titleMedium" style={styles.lineageTitle}>{lead.belt}</Text>
              <Text variant="bodyMedium" style={styles.lineageSub}>{lead.lineage}</Text>
            </View>
          </View>
        </GlassCard>

        <Text style={styles.aboutLbl}>ABOUT</Text>
        <Text variant="bodyLarge" style={styles.about}>{lead.about}</Text>

        <Text style={styles.chipLbl}>DISCIPLINES TAUGHT</Text>
        <View style={styles.chips}>
          {lead.disciplines.map((d) => (
            <Chip key={d} compact style={styles.chip} textStyle={styles.chipText}>
              {d}
            </Chip>
          ))}
        </View>

        <View style={styles.weekHead}>
          <Text variant="titleLarge" style={styles.weekTitle}>Weekly classes</Text>
          <Pressable onPress={() => tabNav.navigate('Classes')} accessibilityRole="button">
            <Text style={styles.scheduleLink}>Schedule →</Text>
          </Pressable>
        </View>

        {coachProfiles.map((c) => (
          <GlassCard key={c.id} style={styles.coachCard}>
            <View style={styles.coachRow}>
              <Image source={c.image} style={styles.photo} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.coachRole}>{c.role}</Text>
                <Text variant="titleMedium" style={styles.coachName}>{c.name}</Text>
                <Text variant="bodySmall" style={styles.coachBelt}>{c.belt}</Text>
              </View>
              <View style={styles.rate}>
                <Icon source="star" size={12} color={palette.green} />
                <Text style={styles.rateText}>{c.rating}</Text>
              </View>
            </View>
          </GlassCard>
        ))}

        <InkButton icon="message-outline" style={styles.msgBtn}>
          Message coach
        </InkButton>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 140 },
  lineageCard: { marginTop: spacing.md },
  lineageRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.lg },
  lineageLbl: { fontFamily: fonts.bold, fontSize: 10, color: colors.textFaint, letterSpacing: 0.8 },
  lineageTitle: { fontFamily: fonts.bold, color: colors.text, marginTop: 4 },
  lineageSub: { fontFamily: fonts.medium, color: colors.textMuted, marginTop: 4 },
  aboutLbl: { fontFamily: fonts.bold, fontSize: 11, color: colors.textFaint, letterSpacing: 0.8, marginTop: spacing.xxl },
  about: { fontFamily: fonts.medium, color: colors.text, lineHeight: 23, marginTop: spacing.sm },
  chipLbl: { fontFamily: fonts.bold, fontSize: 11, color: colors.textFaint, letterSpacing: 0.8, marginTop: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { backgroundColor: palette.green, borderRadius: 999 },
  chipText: { fontFamily: fonts.bold, fontSize: 11, color: '#fff', letterSpacing: 0.4 },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.md },
  weekTitle: { fontFamily: fonts.bold, color: colors.text },
  scheduleLink: { fontFamily: fonts.semi, fontSize: 14, color: palette.green },
  coachCard: { marginBottom: spacing.sm },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  photo: { width: 56, height: 56, borderRadius: 16 },
  coachRole: { fontFamily: fonts.bold, fontSize: 9, color: colors.textFaint, letterSpacing: 0.6 },
  coachName: { fontFamily: fonts.bold, color: colors.text, marginTop: 4 },
  coachBelt: { fontFamily: fonts.medium, color: colors.textMuted, marginTop: 2 },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  msgBtn: { marginTop: spacing.xl },
});
