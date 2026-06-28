import { type Href, router } from 'expo-router';

export const authRoutes = {
  splash: '/(auth)/splash',
  intro: '/(auth)',
  login: '/(auth)/login',
  register: '/(auth)/register',
  forgotPassword: '/(auth)/forgot-password',
  verifyEmail: '/(auth)/verify-email',
  resetVerifyOtp: '/(auth)/reset-verify-otp',
  changePassword: '/(auth)/change-password',
  onboarding: '/(onboarding)',
} as const satisfies Record<string, Href>;

export type AuthNavigateMode = 'push' | 'replace' | 'back';

export function navigateAuth(href: Href, mode: AuthNavigateMode = 'push'): void {
  if (mode === 'back') {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(href);
    return;
  }

  if (mode === 'replace') {
    router.replace(href);
    return;
  }

  router.push(href);
}

export function openAuthLoginFromIntro(): void {
  navigateAuth(authRoutes.login, 'push');
}

export function openAuthRegisterFromIntro(): void {
  navigateAuth(authRoutes.register, 'push');
}

export function switchAuthLoginRegister(target: 'login' | 'register'): void {
  navigateAuth(target === 'login' ? authRoutes.login : authRoutes.register, 'replace');
}

export function openForgotPasswordFromLogin(): void {
  navigateAuth(authRoutes.forgotPassword, 'push');
}

export function backFromForgotPassword(): void {
  navigateAuth(authRoutes.login, 'back');
}
