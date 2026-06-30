import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@/types/database';

export type { UserRole };

export type AuthResult = {
  error: string | null;
  cancelled?: boolean;
  needsConfirmation?: boolean;
  recovery?: boolean;
  email?: string;
};

export interface AuthService {
  getSession(): Promise<Session | null>;
  onAuthStateChange(
    callback: (session: Session | null, event: AuthChangeEvent) => void,
  ): () => void;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  signUpWithGoogle(): Promise<AuthResult>;
  verifySignupOtp(email: string, token: string): Promise<AuthResult>;
  resendSignupOtp(email: string): Promise<AuthResult>;
  sendRecoveryOtp(email: string): Promise<AuthResult>;
  verifyRecoveryOtp(email: string, token: string): Promise<AuthResult>;
  resendRecoveryOtp(email: string): Promise<AuthResult>;
  resetPassword(email: string): Promise<AuthResult>;
  updatePassword(password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  startAutoRefresh(): void;
  stopAutoRefresh(): void;
}

export type AuthUser = User;
