import type { SupportCategory } from '@/features/support/services/supportMessages';

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'checkin',
    question: 'How does QR check-in work?',
    answer:
      'When you arrive, open the Check-in tab and choose Scan entrance. Point your camera at the QR code on the tablet by the door — your location is verified at the academy. You can also switch to My pass to show your personal QR; coaches scan that during roll call if needed. Both codes refresh automatically for security.',
  },
  {
    id: 'booking',
    question: 'Do I need to book classes in the app?',
    answer:
      'No. The schedule is for reference only — simply arrive for any class on the timetable and check in with your QR pass. Booking, if needed, is handled through the academy front desk or the academy website.',
  },
  {
    id: 'points',
    question: 'What are points and rewards for?',
    answer:
      'You earn points automatically every time you check in to a class. Points unlock milestones and can be redeemed for rewards in the Rewards tab. The academy fulfills approved redemptions.',
  },
  {
    id: 'belt',
    question: 'How is my belt progress tracked?',
    answer:
      'Attendance-based requirements update automatically from your check-ins. Skill and assessment requirements are marked by your coach in person. Your Belt Path tab shows current rank, stripes, and what is left for your next promotion.',
  },
  {
    id: 'membership',
    question: 'Why does my membership say it is not active?',
    answer:
      'Membership and billing are managed by the academy and synced from their system. If your status looks wrong, pull to refresh on your Profile, then contact us below and we will check with the front desk.',
  },
  {
    id: 'family',
    question: 'Can I manage my child’s training from my account?',
    answer:
      'Yes. Use Family trainees in the menu to request a linked child account. Once the academy approves it, you can switch profiles to show your child’s QR pass and follow their attendance and progress.',
  },
  {
    id: 'profile',
    question: 'How do I update my name, photo, or phone number?',
    answer:
      'Go to your Profile and tap Edit. You can change your display name, phone number, and profile photo at any time. Membership details are managed by the academy and cannot be edited in the app.',
  },
] as const;

export type SupportCategoryOption = {
  id: SupportCategory;
  label: string;
};

export const SUPPORT_CATEGORIES: readonly SupportCategoryOption[] = [
  { id: 'general', label: 'General' },
  { id: 'membership', label: 'Membership' },
  { id: 'billing', label: 'Billing' },
  { id: 'classes', label: 'Classes' },
  { id: 'technical', label: 'App issue' },
  { id: 'feedback', label: 'Feedback' },
] as const;
