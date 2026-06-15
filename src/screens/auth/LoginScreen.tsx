import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, palette, radii, spacing, typography } from '../../theme';
import { Logo } from '../../components/Logo';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { GlassSurface } from '../../components/GlassSurface';

const heroImg = require('../../../assets/images/hero-bjj.jpg');

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Image source={heroImg} style={styles.heroImg} resizeMode="cover" />
            <LinearGradient
              colors={['rgba(4,8,6,0.2)', 'rgba(4,8,6,0.55)', 'rgba(241,244,242,0.95)']}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.heroTop, { paddingTop: insets.top + spacing.md }]}>
              <View style={styles.logoBadge}>
                <Logo size={30} tint="white" />
              </View>
              <Text style={styles.brand}>971 MMA</Text>
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.earn}>Earn Your Level</Text>
              <Text style={styles.earnSub}>Train on the mat. Track every session. Rise.</Text>
            </View>
          </View>

          <View style={styles.sheet}>
            <GlassSurface strong tone="green" radius={radii.xl} padding={spacing.xxl}>
              <Text style={styles.kicker}>Member access</Text>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                Sign in to check in, track sessions, and earn rewards.
              </Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={{ height: spacing.xl }} />

              <TextField
                label="Email"
                icon="mail-outline"
                placeholder="you@email.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
              <TextField
                label="Password"
                icon="lock-closed-outline"
                placeholder="••••••••"
                password
                value={password}
                onChangeText={setPassword}
              />

              <Pressable style={styles.forgot} hitSlop={8}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>

              <Button label="Sign in" onPress={onSubmit} loading={loading} />
            </GlassSurface>

            <View style={styles.footer}>
              <Text style={styles.footerText}>New to 971 MMA? </Text>
              <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={8}>
                <Text style={styles.footerLink}>Create account</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink900 },
  scroll: { flexGrow: 1 },
  hero: { height: 340, overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%' },
  heroTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: '#fff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroBottom: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xxl,
  },
  earn: {
    fontFamily: fonts.displayBlack,
    fontSize: 36,
    color: '#fff',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  earnSub: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    marginTop: spacing.sm,
  },
  sheet: {
    marginTop: -spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  kicker: { fontFamily: fonts.semi, color: colors.accent, fontSize: 13 },
  title: { ...typography.h1, color: colors.text, marginTop: 8 },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  errorBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.redLine,
  },
  errorText: { color: palette.red, fontFamily: fonts.semi, fontSize: 13.5 },
  forgot: { alignSelf: 'flex-end', marginBottom: spacing.lg },
  forgotText: { color: colors.accent, fontFamily: fonts.semi, fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl },
  footerText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
  footerLink: { color: colors.accent, fontFamily: fonts.semi, fontSize: 14 },
});
