import React, { useState } from 'react';
import {
  Alert,
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
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, palette, radii, spacing, typography } from '../../theme';
import { Logo } from '../../components/Logo';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { ScreenShell } from '../../components/ScreenShell';
import { GlassSurface } from '../../components/GlassSurface';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { error, needsConfirmation } = await signUp(email, password, name);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    if (needsConfirmation) {
      Alert.alert(
        'Confirm your email',
        'We sent a confirmation link to your inbox. Verify it, then sign in.',
        [{ text: 'Go to sign in', onPress: () => navigation.navigate('Login') }],
      );
    }
  };

  return (
    <ScreenShell>
      <StatusBar style="dark" />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={10} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Logo size={30} tint="black" />
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>Join the academy</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Check in with your pass, browse the schedule, and track your progress.
          </Text>

          <View style={{ height: spacing.xl }} />

          <GlassSurface strong radius={radii.xl} padding={spacing.xxl}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TextField
              label="Full name"
              icon="person-outline"
              placeholder="Khalid Ahmed"
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
            />
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
              placeholder="At least 6 characters"
              password
              value={password}
              onChangeText={setPassword}
            />

            <Text style={styles.terms}>
              By creating an account you agree to the 971 MMA membership terms and code of conduct.
            </Text>

            <Button label="Create account" onPress={onSubmit} loading={loading} />
          </GlassSurface>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already a member? </Text>
            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glass08,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
  },
  kicker: { fontFamily: fonts.semi, color: colors.accent, fontSize: 13 },
  title: { ...typography.h1, color: colors.text, marginTop: 8 },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  errorBox: {
    marginBottom: spacing.lg,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.redLine,
  },
  errorText: { color: palette.red, fontFamily: fonts.semi, fontSize: 13.5 },
  terms: { color: colors.textFaint, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.xl },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl },
  footerText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
  footerLink: { color: colors.accentBright, fontFamily: fonts.bold, fontSize: 14 },
});
