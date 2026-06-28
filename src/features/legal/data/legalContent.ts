export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalDocument = {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

const CONTACT_LINE = 'For any questions, contact us at info@971mma.com or +971 54 332 3980.';

export const PRIVACY_DOCUMENT: LegalDocument = {
  eyebrow: 'Privacy policy',
  title: 'Your privacy at 971 MMA',
  lastUpdated: 'June 2026',
  intro:
    'This Privacy Policy explains what information the 971 MMA app collects, how we use it, and the choices you have. By using the app you agree to the practices described here.',
  sections: [
    {
      heading: '1. Information we collect',
      paragraphs: [
        'Account information: your email address and the password you set when registering. Passwords are managed securely by our authentication provider and are never stored in plain text.',
        'Profile information: your name, date of birth, phone number, and profile photo that you provide during sign-up or when editing your profile.',
        'Training activity: class check-ins, attendance history, points, milestones, and belt progression generated as you train at the academy.',
        'Membership information: your membership plan and status, synced from the academy’s management system.',
        'Technical information: basic device and app information needed to keep the app secure and working correctly.',
      ],
    },
    {
      heading: '2. How we use your information',
      paragraphs: [
        'We use your information to operate the app: to authenticate you, show your schedule, record check-ins, track rewards and belt progress, and display your membership status.',
        'We use the message you submit through Help & Support to respond to your request and improve the academy experience.',
        'We do not sell your personal information to third parties.',
      ],
    },
    {
      heading: '3. Third-party services',
      paragraphs: [
        'Mindbody: the academy uses Mindbody to manage memberships, schedules, and attendance. Relevant data is synced between Mindbody and the app so your information stays consistent.',
        'Supabase: we use Supabase to securely host your account, profile, and training data. Access is protected by row-level security so members can only read their own records.',
      ],
    },
    {
      heading: '4. Data storage and security',
      paragraphs: [
        'Your authentication session is stored securely on your device using the platform’s encrypted storage. Sensitive academy credentials are never stored in the app.',
        'We apply industry-standard safeguards to protect your data, but no method of transmission or storage is completely secure. Please keep your login details private.',
      ],
    },
    {
      heading: '5. Children and guardian accounts',
      paragraphs: [
        'Parents and guardians may request linked accounts for child trainees. Guardian access is granted only after academy approval.',
        'Guardians can view and present a child’s training information; child training records remain separate and protected.',
      ],
    },
    {
      heading: '6. Your rights and choices',
      paragraphs: [
        'You can review and update your name, phone number, and profile photo at any time from the Edit Profile screen.',
        'You can request deletion of your account from the Profile screen. Deletion requests are reviewed by academy staff to handle membership and billing correctly.',
        'You may also contact us to ask what information we hold about you.',
      ],
    },
    {
      heading: '7. Changes to this policy',
      paragraphs: [
        'We may update this Privacy Policy from time to time. Material changes will be reflected by updating the “last updated” date above.',
        CONTACT_LINE,
      ],
    },
  ],
};

export const TERMS_DOCUMENT: LegalDocument = {
  eyebrow: 'Terms & conditions',
  title: 'Terms of use',
  lastUpdated: 'June 2026',
  intro:
    'These Terms govern your use of the 971 MMA app. By creating an account or using the app, you agree to these Terms. If you do not agree, please do not use the app.',
  sections: [
    {
      heading: '1. Your account',
      paragraphs: [
        'You must provide accurate information when registering and keep your login details secure. You are responsible for activity that happens under your account.',
        'You must be of an age permitted by the academy to hold an account, or have a parent or guardian manage your account on your behalf.',
      ],
    },
    {
      heading: '2. Classes and check-in',
      paragraphs: [
        'The class schedule in the app is provided for reference. The app does not handle class bookings; simply attend a scheduled class and check in with your QR pass at the academy.',
        'Your QR pass is personal to you. Do not share screenshots of it; passes refresh regularly and single-use codes are rejected if reused.',
      ],
    },
    {
      heading: '3. Points and rewards',
      paragraphs: [
        'Points are earned through attendance and are a loyalty feature offered at the academy’s discretion. They have no cash value and cannot be transferred or exchanged for cash.',
        'Reward availability, point costs, and fulfillment are determined by the academy and may change. Redemptions are subject to approval and inventory.',
      ],
    },
    {
      heading: '4. Belt progression',
      paragraphs: [
        'Attendance-based progress updates automatically from your check-ins. Skill assessments, stripes, and promotions are awarded by coaches in person and remain at the academy’s discretion.',
      ],
    },
    {
      heading: '5. Acceptable use',
      paragraphs: [
        'You agree not to misuse the app, attempt to access other members’ data, tamper with check-in or rewards systems, or use the app for any unlawful purpose.',
        'We may suspend or terminate access for conduct that violates these Terms or harms other members or the academy.',
      ],
    },
    {
      heading: '6. Guardian and family accounts',
      paragraphs: [
        'Guardians who manage child trainee accounts are responsible for the use of those accounts and for ensuring information provided is accurate.',
      ],
    },
    {
      heading: '7. Membership and billing',
      paragraphs: [
        'Membership status and billing are managed by the academy through its management system. The app displays this information for your convenience but is not a billing platform.',
      ],
    },
    {
      heading: '8. Disclaimers and liability',
      paragraphs: [
        'Martial arts training carries inherent physical risk. The app provides information and tools only and does not replace in-person guidance from qualified coaches.',
        'The app is provided “as is.” To the extent permitted by law, the academy is not liable for indirect or incidental damages arising from your use of the app.',
      ],
    },
    {
      heading: '9. Governing law',
      paragraphs: [
        'These Terms are governed by the laws of the Emirate of Dubai and the United Arab Emirates.',
        CONTACT_LINE,
      ],
    },
  ],
};
