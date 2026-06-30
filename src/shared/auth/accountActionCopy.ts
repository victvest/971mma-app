export type AccountActionKey =
  | 'check-in'
  | 'track-progress'
  | 'earn-rewards'
  | 'family-profiles'
  | 'access-profile'
  | 'access-notifications'
  | 'access-communities'
  | 'access-mindbody';

export type AccountActionCopy = {
  title: string;
  anonymousDescription: string;
  activationDescription: string;
};

export const ACCOUNT_ACTION_COPY: Record<AccountActionKey, AccountActionCopy> = {
  'check-in': {
    title: 'Digital check-in pass',
    anonymousDescription:
      'Your QR pass gets you through reception in seconds. Join the academy to activate yours.',
    activationDescription:
      'Link your membership to generate your QR pass and check in at the academy.',
  },
  'track-progress': {
    title: 'Your belt path',
    anonymousDescription:
      'Track ranks, stripes, and what comes next in BJJ and wrestling. Join the academy to unlock your journey.',
    activationDescription:
      'Link your membership to track belts, complete requirements, and celebrate promotions.',
  },
  'earn-rewards': {
    title: 'Earn as you train',
    anonymousDescription:
      'Every session builds points toward milestones and rewards. Join the academy to start earning.',
    activationDescription:
      'Activate your membership to unlock the points economy, milestones, and redemptions.',
  },
  'family-profiles': {
    title: 'Track your child\'s progress',
    anonymousDescription:
      'Parent at 971? We\'ve got you. Join the academy to link family profiles and follow each child\'s training, ranks, and check-ins.',
    activationDescription:
      'Link your membership to switch family profiles and track each trainee\'s progress.',
  },
  'access-profile': {
    title: 'Your member profile',
    anonymousDescription:
      'Your photo, training history, and achievements live here. Join the academy to unlock yours.',
    activationDescription:
      'Link your membership to access your profile and full training history.',
  },
  'access-notifications': {
    title: 'Stay in the loop',
    anonymousDescription:
      'Class updates, rewards, and academy news—right when you need them. Join the academy to turn notifications on.',
    activationDescription:
      'Link your membership to receive class, rewards, and academy notifications.',
  },
  'access-communities': {
    title: 'Academy communities',
    anonymousDescription:
      'Connect with your class, coaches, and training groups in the app. Join the academy to join the conversation.',
    activationDescription:
      'Activate your membership to join academy communities and stay connected with your team.',
  },
  'access-mindbody': {
    title: 'Your Mindbody ID',
    anonymousDescription:
      'Your linked membership and academy ID in one place. Join the academy to connect your Mindbody account.',
    activationDescription:
      'Link your membership to view your Mindbody ID and membership details.',
  },
};
