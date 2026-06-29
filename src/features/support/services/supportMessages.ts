import { getSupabaseClient } from '@/services/supabase/client';
import { useAuthStore } from '@/stores/useAuthStore';

export type SupportCategory =
  | 'general'
  | 'membership'
  | 'billing'
  | 'technical'
  | 'classes'
  | 'feedback';

export type SupportMessageStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type SupportMessage = {
  id: string;
  userId: string | null;
  category: SupportCategory;
  subject: string;
  message: string;
  contactEmail: string | null;
  contactName: string | null;
  status: SupportMessageStatus;
  createdAt: string;
};

type SupportMessageRow = {
  id: string;
  user_id: string | null;
  category: SupportCategory;
  subject: string;
  message: string;
  contact_email: string | null;
  contact_name: string | null;
  status: SupportMessageStatus;
  created_at: string;
};

export type SubmitSupportMessageInput = {
  category: SupportCategory;
  subject: string;
  message: string;
  contactEmail?: string;
  contactName?: string;
};

const ERROR_COPY: Record<string, string> = {
  UNAUTHORIZED: 'Please sign in again to contact support.',
  SUBJECT_REQUIRED: 'Add a short subject so we know what this is about.',
  MESSAGE_REQUIRED: 'Add a message describing how we can help.',
  MESSAGE_TOO_LONG: 'Your message is too long. Please keep it under 2000 characters.',
  CONTACT_NAME_REQUIRED: 'Enter your full name so we know who to reply to.',
  CONTACT_EMAIL_REQUIRED: 'Enter your email address so we can reply.',
  CONTACT_EMAIL_INVALID: 'Enter a valid email address.',
  TOO_MANY_OPEN_MESSAGES:
    'You already have several open requests. We will reply to those first.',
};

function mapRow(row: SupportMessageRow): SupportMessage {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    subject: row.subject,
    message: row.message,
    contactEmail: row.contact_email,
    contactName: row.contact_name,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function friendlySupportError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  for (const code of Object.keys(ERROR_COPY)) {
    if (raw.includes(code)) return ERROR_COPY[code];
  }
  return 'Could not send your message. Please try again.';
}

export async function submitSupportMessage(
  input: SubmitSupportMessageInput,
): Promise<SupportMessage> {
  const { role, user } = useAuthStore.getState();
  const isAnonymousGuest = role === 'guest' && user === null;

  if (isAnonymousGuest) {
    const { data, error } = await getSupabaseClient().rpc('submit_guest_support_message', {
      p_category: input.category,
      p_subject: input.subject,
      p_message: input.message,
      p_contact_email: input.contactEmail?.trim() ?? '',
      p_contact_name: input.contactName?.trim() ?? '',
    });

    if (error) throw error;
    return mapRow(data as SupportMessageRow);
  }

  const { data, error } = await getSupabaseClient().rpc('submit_support_message', {
    p_category: input.category,
    p_subject: input.subject,
    p_message: input.message,
  });

  if (error) throw error;
  return mapRow(data as SupportMessageRow);
}
