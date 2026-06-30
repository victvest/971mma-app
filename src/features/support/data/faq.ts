import type { SupportCategory } from '@/features/support/services/supportMessages';

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

/** Academy FAQs from https://971mma.com/faq plus app-specific member questions. */
export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'checkin',
    question: 'How does QR check-in work?',
    answer:
      'When you arrive, open the Check-in tab and choose Scan entrance. Point your camera at the QR code on the tablet by the door — your location is verified at the academy. You can also switch to My pass to show your personal QR; coaches scan that during roll call if needed. Both codes refresh automatically for security.',
  },
  {
    id: 'programs',
    question: 'What martial arts and fitness programs do you offer?',
    answer:
      'We offer Brazilian Jiu-Jitsu (including Next Level BJJ), Freestyle Wrestling, Muay Thai, Mixed Martial Arts (MMA), Boxing, Performance Fitness, and Personal Training. We also have specialized programs for youth and teens.',
  },
  {
    id: 'beginners',
    question: 'Is 971 MMA suitable for beginners?',
    answer:
      'Absolutely. We warmly welcome individuals of all skill levels, ranging from complete beginners to professional athletes. Our coaches are skilled at guiding members with diverse levels of experience, and every class is structured to accommodate newcomers.',
  },
  {
    id: 'free-trial',
    question: 'Can I try a class before joining?',
    answer:
      'Absolutely. We encourage prospective members to experience a class firsthand and discover the 971 MMA difference themselves. Your first class is completely free — no commitment required.',
  },
  {
    id: 'gear',
    question: 'What equipment do I need for my first class?',
    answer:
      'Basic gear includes comfortable workout clothes. Specific classes like BJJ require a gi/kimono. For No-Gi, wear a rash guard and grappling shorts or spats. For Muay Thai and Boxing, boxing gloves and hand wraps are required. Our team will advise you on exactly what you need when you book your free trial.',
  },
  {
    id: 'youth',
    question: 'Do you offer classes for children and teens?',
    answer:
      'Yes, we offer specialized programs tailored for kids and teens, such as Muay Thai for Teens, MMA for Teens, and BJJ for Kids (ages 7–14). Our youth programs focus on discipline, confidence, and physical development in a safe environment.',
  },
  {
    id: 'belt',
    question: 'How do I upgrade my belt tier?',
    answer:
      'Attendance-based requirements update automatically from your check-ins. Skill and assessment requirements are marked by your coach in person. Your Belt Path tab shows current rank, stripes, and what is left for your next promotion.',
  },
  {
    id: 'membership-freeze',
    question: 'Can I freeze my membership?',
    answer:
      'Membership changes, including freezes and pauses, are handled by the academy front desk. Contact us at info@971mma.com or +971 54 332 3980 and our team will help with your request.',
  },
  {
    id: 'schedules',
    question: 'Where can I learn more about class schedules?',
    answer:
      'Contact us directly at +971 54 332 3980 for the most up-to-date information on schedules and membership packages. You can also book a free trial class at 971mma.com.',
  },
  {
    id: 'membership-status',
    question: 'Why does my membership say it is not active?',
    answer:
      'Membership and billing are managed by the academy and synced from their system. If your status looks wrong, pull to refresh on your Profile, then contact us below and we will check with the front desk.',
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
