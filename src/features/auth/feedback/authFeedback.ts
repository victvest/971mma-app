import { authToast } from '@/shared/components/Toast';

export const authFeedback = {
  otpSent: () => authToast.success('Code sent', 'Check your inbox for the 6-digit code.'),
  otpResent: () => authToast.success('Code resent', 'Check your inbox for a new 6-digit code.'),
  accountCreated: () => authToast.success('Account created', "Let's set up your profile."),
  accountCreatedPending: () =>
    authToast.success(
      'Account created',
      'Your profile is ready. Some member features unlock after academy activation.',
    ),
  accountActivated: () =>
    authToast.success('Membership linked', 'Your academy membership is now active in the app.'),
  activationRequired: () =>
    authToast.warning(
      'Activation required',
      'We could not match your email or phone to a single Mindbody profile. Visit the front desk or open Activation in your profile.',
    ),
  ambiguousMindbodyMatch: () =>
    authToast.warning(
      'Multiple profiles found',
      'More than one Mindbody profile matches your details. Ask the front desk to link the correct membership.',
    ),
  passwordReset: () => authToast.success('Password reset', 'Sign in with your new password.'),
  profileReady: () => authToast.success('Profile ready', 'Welcome to 971 MMA.'),
} as const;
