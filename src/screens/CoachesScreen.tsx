import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, fonts, palette, radii, shadow, spacing } from '../theme';
import { AcademyHeader } from '../components/AcademyHeader';
import { ScreenShell } from '../components/ScreenShell';
import { UaeFlagIcon } from '../components/UaeFlagIcon';
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
        <View style={[styles.lineageCard, shadow.soft]}>
          <UaeFlagIcon />
          <View style={{ flex: 1 }}>
            <Text style={styles.lineageLbl}>BELT & LINEAGE</Text>
            <Text style={styles.lineageTitle}>{lead.belt}</Text>
            <Text style={styles.lineageSub}>{lead.lineage}</Text>
          </View>
        </View>

        <Text style={styles.aboutLbl}>ABOUT</Text>
        <Text style={styles.about}>{lead.about}</Text>

        <Text style={styles.chipLbl}>DISCIPLINES TAUGHT</Text>
        <View style={styles.chips}>
          {lead.disciplines.map((d) => (
            <View key={d} style={styles.chip}>
              <Text style={styles.chipText}>{d}</Text>
            </View>
          ))}
        </View>

        <View style={styles.weekHead}>
          <Text style={styles.weekTitle}>Weekly classes</Text>
          <Pressable onPress={() => tabNav.navigate('Classes')} accessibilityRole="button">
            <Text style={styles.scheduleLink}>Schedule →</Text>
          </Pressable>
        </View>

        {coachProfiles.map((c) => (
          <View key={c.id} style={[styles.coachCard, shadow.soft]}>
            <Image source={c.image} style={styles.photo} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.coachRole}>{c.role}</Text>
              <Text style={styles.coachName}>{c.name}</Text>
              <Text style={styles.coachBelt}>{c.belt}</Text>
            </View>
            <View style={styles.rate}>
              <Ionicons name="star" size={12} color={palette.green} />
              <Text style={styles.rateText}>{c.rating}</Text>
            </View>
          </View>
        ))}

        <Pressable style={[styles.msgBtn, shadow.soft]} accessibilityRole="button">
          <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
          <Text style={styles.msgText}>Message coach</Text>
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 140 },
  lineageCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.hairline,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  lineageLbl: { fontFamily: fonts.bold, fontSize: 10, color: colors.textFaint, letterSpacing: 0.8 },
  lineageTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginTop: 4 },
  lineageSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  aboutLbl: { fontFamily: fonts.bold, fontSize: 11, color: colors.textFaint, letterSpacing: 0.8, marginTop: spacing.xxl },
  about: { fontFamily: fonts.medium, fontSize: 15, color: colors.text, lineHeight: 23, marginTop: spacing.sm },
  chipLbl: { fontFamily: fonts.bold, fontSize: 11, color: colors.textFaint, letterSpacing: 0.8, marginTop: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { backgroundColor: palette.green, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill },
  chipText: { fontFamily: fonts.bold, fontSize: 11, color: '#fff', letterSpacing: 0.4 },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.md },
  weekTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  scheduleLink: { fontFamily: fonts.semi, fontSize: 14, color: palette.green },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.hairline,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  photo: { width: 56, height: 56, borderRadius: radii.md },
  coachRole: { fontFamily: fonts.bold, fontSize: 9, color: colors.textFaint, letterSpacing: 0.6 },
  coachName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginTop: 4 },
  coachBelt: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.black,
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  msgText: { fontFamily: fonts.semi, fontSize: 15, color: '#fff' },
});
