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
import { colors, palette, radii, spacing, typography } from '../../theme';
import { Logo } from '../../components/Logo';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';

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
        <Image source={heroImg} style={StyleSheet.absoluteFill as any} />
        <LinearGradient
          colors={['rgba(11,11,12,0.35)', 'rgba(11,11,12,0.55)', palette.black]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + 24 }]}>
          <Logo size={56} tint="white" />
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>971 MMA</Text>
            <Text style={styles.brandSub}>& FITNESS ACADEMY</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <ScrollView
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to check in, book classes, and track your progress.</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={{ height: spacing.lg }} />

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
  root: { flex: 1, backgroundColor: palette.black },
  hero: { height: 300 },
  heroContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  brandWrap: { alignItems: 'center' },
  brand: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  brandSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 4,
  },
  sheetWrap: {
    flex: 1,
    marginTop: -28,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.huge,
    minHeight: '100%',
  },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  errorBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(232,25,44,0.2)',
  },
  errorText: { color: colors.danger, fontSize: 13.5, fontWeight: '600' },
  forgot: { alignSelf: 'flex-end', marginBottom: spacing.lg },
  forgotText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  footerLink: { color: colors.accent, fontSize: 14, fontWeight: '800' },
});
