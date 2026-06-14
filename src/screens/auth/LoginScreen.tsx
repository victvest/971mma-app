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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, palette, radii, spacing, typography } from '../../theme';
import { Logo } from '../../components/Logo';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { GlassSurface } from '../../components/GlassSurface';
import { ScreenShell } from '../../components/ScreenShell';

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
    <ScreenShell>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <View style={styles.logoBadge}>
              <Logo size={36} tint="black" />
            </View>
            <Text style={styles.brand}>971 MMA</Text>
            <Text style={styles.brandSub}>Fitness Academy · Dubai</Text>
          </View>

          <View style={styles.heroStrip}>
            <Image source={heroImg} style={styles.heroImg} resizeMode="cover" />
          </View>

          <GlassSurface strong tone="green" radius={radii.xl} padding={spacing.xxl}>
            <Text style={styles.kicker}>Member access</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to check in at the gym and track your training.
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  brandBlock: { alignItems: 'center', marginBottom: spacing.xl },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: palette.glass12,
    borderWidth: 1,
    borderColor: palette.greenLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontFamily: fonts.displayBlack, color: colors.text, fontSize: 32, letterSpacing: 0.3, marginTop: spacing.md },
  brandSub: { fontFamily: fonts.medium, color: colors.textMuted, fontSize: 13, marginTop: 4 },
  heroStrip: {
    height: 120,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  heroImg: { width: '100%', height: '100%' },
  kicker: { fontFamily: fonts.semi, color: colors.accent, fontSize: 13 },
  title: { ...typography.h1, color: colors.text, marginTop: 8 },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  errorBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(232,25,44,0.25)',
  },
  errorText: { color: palette.redBright, fontFamily: fonts.semi, fontSize: 13.5 },
  forgot: { alignSelf: 'flex-end', marginBottom: spacing.lg },
  forgotText: { color: colors.accent, fontFamily: fonts.semi, fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl },
  footerText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
  footerLink: { color: colors.accent, fontFamily: fonts.semi, fontSize: 14 },
});
