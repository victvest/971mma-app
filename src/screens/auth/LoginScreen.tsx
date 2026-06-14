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
      <View style={styles.hero}>
        <Image source={heroImg} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(4,6,10,0.25)', 'rgba(4,6,10,0.75)', palette.ink900]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + 28 }]}>
          <View style={styles.logoRing}>
            <Logo size={46} tint="white" />
          </View>
          <Text style={styles.brand}>971 MMA</Text>
          <Text style={styles.brandSub}>& FITNESS ACADEMY</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <GlassSurface strong tone="green" radius={radii.xl} padding={spacing.xxl}>
            <Text style={styles.kicker}>MEMBER ACCESS</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to check in, book classes, and track your progress.
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink900 },
  hero: { height: 320 },
  heroContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  logoRing: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: palette.greenLine,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  brand: { fontFamily: fonts.displayBlack, color: '#fff', fontSize: 38, letterSpacing: 1 },
  brandSub: {
    fontFamily: fonts.semi,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    letterSpacing: 4,
  },
  sheetWrap: { flex: 1, marginTop: -48 },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
  },
  kicker: { fontFamily: fonts.bold, color: colors.accentBright, fontSize: 11, letterSpacing: 2 },
  title: { ...typography.h1, color: colors.text, marginTop: 8 },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  errorBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,59,78,0.35)',
  },
  errorText: { color: palette.redBright, fontFamily: fonts.semi, fontSize: 13.5 },
  forgot: { alignSelf: 'flex-end', marginBottom: spacing.lg },
  forgotText: { color: colors.accentBright, fontFamily: fonts.bold, fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl },
  footerText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
  footerLink: { color: colors.accentBright, fontFamily: fonts.bold, fontSize: 14 },
});
