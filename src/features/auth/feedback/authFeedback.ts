import { authToast } from '@/shared/components/Toast';

export const authFeedback = {
  otpSent: () => authToast.success('Code sent', 'Check your inbox for the 6-digit code.'),
  otpResent: () => authToast.success('Code resent', 'Check your inbox for a new 6-digit code.'),
  accountCreated: () => authToast.success('Account created', "Let's set up your profile."),
  passwordReset: () => authToast.success('Password reset', 'Sign in with your new password.'),
  profileReady: () => authToast.success('Profile ready', 'Welcome to 971 MMA.'),
} as const;
