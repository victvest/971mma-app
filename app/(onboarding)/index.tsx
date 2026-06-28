import React, { useEffect, useRef, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Calendar, User } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import { AuthTextField } from '@/features/auth/components/AuthExperience';
import { OnboardingScreen } from '@/features/onboarding/components/OnboardingExperience';
import { SetupStepControls } from '@/features/onboarding/components/SetupStepControls';
import { useOnboardingStepTransition } from '@/features/onboarding/hooks/useOnboardingStepTransition';
import {
  ageToDateOfBirth,
  dateOfBirthToAge,
  initialsFromName,
  validateOnboardingAge,
  validateOnboardingName,
} from '@/features/onboarding/services/onboardingValidation';
import { authFeedback } from '@/features/auth/feedback/authFeedback';
import { profileKey } from '@/features/profile/hooks/useProfile';
import { uploadAvatar } from '@/features/profile/services/avatarUpload';
import { completeOnboarding, getMyProfile } from '@/services/database/profiles.repository';
import { authToast } from '@/shared/components/Toast';
import { getDefaultHomeRoute } from '@/shared/navigation/defaultHomeRoute';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';

const TOTAL_STEPS = 3;
const AGE_INPUT_ACCESSORY_ID = 'onboarding-age-empty-accessory';

const STEP_COPY = [
  {
    title: 'Welcome',
    subtitle: "Let's personalize your account. What should we call you?",
  },
  {
    title: 'How old are you?',
    subtitle: 'This helps us tailor classes and academy programs for you.',
  },
  {
    title: 'Add your photo',
    subtitle: 'Pick a clear photo so coaches can recognize you at check-in.',
  },
] as const;

export default function OnboardingWizardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, markOnboardingComplete } = useAuth();
  const role = useAuthStore((s) => s.role);
  const { colors, typography, gap, radius, layout, inset } = useTheme();
  const { goForward, goBackward, getStepAnimation } = useOnboardingStepTransition();
  const { entering, exiting } = getStepAnimation();

  const nameRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydratedProfile, setHydratedProfile] = useState(false);

  const copy = STEP_COPY[step];
  const previewInitials = initialsFromName(fullName);

  useEffect(() => {
    if (!user?.id || hydratedProfile) return;

    let cancelled = false;

    void (async () => {
      try {
        const profile = await getMyProfile(user.id);
        if (cancelled || !profile) {
          if (!cancelled) setHydratedProfile(true);
          return;
        }

        if (profile.onboardingCompletedAt) {
          markOnboardingComplete({
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
          });
          router.replace(getDefaultHomeRoute(role));
          return;
        }

        if (profile.fullName) setFullName(profile.fullName);

        const derivedAge = profile.dateOfBirth ? dateOfBirthToAge(profile.dateOfBirth) : null;
        if (derivedAge !== null) setAge(String(derivedAge));

        if (profile.avatarUrl) setAvatarUri(profile.avatarUrl);
      } catch {
        // Keep the wizard usable even if profile hydration fails.
      } finally {
        if (!cancelled) setHydratedProfile(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydratedProfile, markOnboardingComplete, role, router, user?.id]);

  function showError(message: string) {
    Keyboard.dismiss();
    authToast.error('Profile setup', message);
  }

  function goToAgeStep() {
    const nameError = validateOnboardingName(fullName);
    if (nameError) {
      showError(nameError);
      nameRef.current?.focus();
      return;
    }
    goForward();
    setStep(1);
  }

  function goToAvatarStep() {
    const ageError = validateOnboardingAge(age);
    if (ageError) {
      showError(ageError);
      return;
    }
    Keyboard.dismiss();
    goForward();
    setStep(2);
  }

  function goToNameStep() {
    goBackward();
    setStep(0);
    requestAnimationFrame(() => nameRef.current?.focus());
  }

  function goToAgeFromAvatar() {
    goBackward();
    setStep(1);
  }

  function handleBack() {
    if (step === 2) {
      goToAgeFromAvatar();
      return;
    }
    if (step === 1) {
      goToNameStep();
    }
  }

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showError('Allow photo access to add a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  async function handleFinish() {
    const nameError = validateOnboardingName(fullName);
    if (nameError) {
      showError(nameError);
      goBackward();
      setStep(0);
      return;
    }

    const ageError = validateOnboardingAge(age);
    if (ageError) {
      showError(ageError);
      goBackward();
      setStep(1);
      return;
    }

    if (!avatarUri) {
      showError('Add a profile photo to continue.');
      return;
    }

    if (!user?.id) {
      showError('Session expired. Sign in again.');
      return;
    }

    setLoading(true);
    try {
      const avatarUrl = await uploadAvatar(user.id, avatarUri);
      const profile = await completeOnboarding({
        fullName: fullName.trim(),
        dateOfBirth: ageToDateOfBirth(Number(age)),
        avatarUrl,
      });

      if (!profile.onboardingCompletedAt) {
        showError('Profile saved but setup is still incomplete. Please try again.');
        return;
      }

      markOnboardingComplete({
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
      });

      void queryClient.invalidateQueries({ queryKey: profileKey(user.id) });
      void queryClient.invalidateQueries({ queryKey: ['active-profile-summaries'] });

      authFeedback.profileReady();
      router.replace(getDefaultHomeRoute(role));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save your profile.';
      showError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingScreen
      step={step}
      totalSteps={TOTAL_STEPS}
      title={copy.title}
      subtitle={copy.subtitle}
      entering={entering}
      exiting={exiting}
      controls={
        <SetupStepControls
          step={step}
          totalSteps={TOTAL_STEPS}
          onBack={handleBack}
          onPrimary={
            step === 0
              ? goToAgeStep
              : step === 1
                ? goToAvatarStep
                : handleFinish
          }
          loading={step === 2 ? loading : false}
          disabled={step === 2 ? !avatarUri : false}
        />
      }
    >
      {step === 0 ? (
        <>
          <AuthTextField
            ref={nameRef}
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            placeholder="Your full name"
            icon={User}
            returnKeyType="next"
            onSubmitEditing={goToAgeStep}
          />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <AuthTextField
            ref={ageRef}
            label="Age"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            textContentType="none"
            placeholder="e.g. 28"
            icon={Calendar}
            maxLength={3}
            inputAccessoryViewID={AGE_INPUT_ACCESSORY_ID}
            returnKeyType="done"
            onSubmitEditing={goToAvatarStep}
          />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <View style={{ alignItems: 'center', gap: gap.md }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose profile photo"
              onPress={pickAvatar}
              style={[
                styles.avatarAnchor,
                {
                  width: layout.authBrandMark * 1.35,
                  height: layout.authBrandMark * 1.35,
                },
              ]}
            >
              <View
                style={[
                  styles.avatarCircle,
                  {
                    borderRadius: radius.avatar,
                    borderColor: colors.accent.default,
                    borderWidth: layout.borderWidthStrong,
                    backgroundColor: avatarUri
                      ? colors.background.elevated
                      : colors.accent.subtle,
                  },
                ]}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Text
                    style={{
                      ...typography.textPresets.title,
                      color: colors.accent.default,
                      fontWeight: '800',
                    }}
                  >
                    {previewInitials}
                  </Text>
                )}
              </View>
              {!avatarUri ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.cameraBadge,
                    {
                      backgroundColor: colors.accent.default,
                      borderRadius: radius.pill,
                      bottom: -inset['2xs'],
                      height: layout.appHeaderIconTouch * 0.64,
                      right: -inset['2xs'],
                      width: layout.appHeaderIconTouch * 0.64,
                      zIndex: 2,
                    },
                  ]}
                >
                  <Camera size={18} color={colors.accent.onAccent} strokeWidth={2.2} />
                </View>
              ) : null}
            </Pressable>

            <Text
              style={[
                typography.textPresets.footnote,
                { color: colors.text.tertiary, textAlign: 'center' },
              ]}
            >
              Tap to choose from your library
            </Text>
          </View>
        </>
      ) : null}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={AGE_INPUT_ACCESSORY_ID}>
          <View style={styles.hiddenInputAccessory} />
        </InputAccessoryView>
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  hiddenInputAccessory: {
    height: 0,
  },
  avatarAnchor: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarCircle: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  cameraBadge: {
    alignItems: 'center',
    elevation: 2,
    justifyContent: 'center',
    position: 'absolute',
  },
});
