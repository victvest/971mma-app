import type { CoachItem } from '@/types/domain';

export type CoachSpotlightTestimonial = {
  id: string;
  headline: string;
  quote: string;
  student: string;
  rank: string;
  avatar: string;
  rating: number;
};

const AVATARS = [
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=120&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=120&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=120&auto=format&fit=crop',
] as const;

function isGrapplingCoach(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('khalid') ||
    lower.includes('bjj') ||
    lower.includes('jiu') ||
    lower.includes('belt')
  );
}

export function getCoachSpotlightTestimonials(
  coach: CoachItem,
  coachFirstName: string,
): CoachSpotlightTestimonial[] {
  const grappling = isGrapplingCoach(coach.name);

  if (grappling) {
    return [
      {
        id: `${coach.id}-spotlight-1`,
        headline: 'Transformed my game',
        quote: `Training under ${coachFirstName} completely changed my approach to Jiu-Jitsu. His focus on micro-adjustments and pressure has elevated my game entirely.`,
        student: 'Marcus T.',
        rank: 'BLUE BELT',
        avatar: AVATARS[1],
        rating: 5,
      },
      {
        id: `${coach.id}-spotlight-2`,
        headline: 'Technical and patient',
        quote: `${coachFirstName} breaks down complex positions into steps anyone can follow. I finally understand guard retention after months of struggling on my own.`,
        student: 'Layla K.',
        rank: 'PURPLE BELT',
        avatar: AVATARS[3],
        rating: 5,
      },
      {
        id: `${coach.id}-spotlight-3`,
        headline: 'Best academy coach',
        quote: `Every class with ${coachFirstName} feels structured and purposeful. The attention to detail in drilling and live rounds keeps me coming back three times a week.`,
        student: 'James R.',
        rank: 'WHITE BELT',
        avatar: AVATARS[4],
        rating: 5,
      },
    ];
  }

  return [
    {
      id: `${coach.id}-spotlight-1`,
      headline: 'Incredible energy',
      quote: `Coach ${coachFirstName} brings incredible energy and technical precision to every session. The detail in combinations and defensive slips has helped me progress so much faster.`,
      student: 'Sarah L.',
      rank: 'ADVANCED MEMBER',
      avatar: AVATARS[0],
      rating: 5,
    },
    {
      id: `${coach.id}-spotlight-2`,
      headline: 'Confidence on the mats',
      quote: `${coachFirstName} creates a welcoming environment while still pushing you hard. I went from nervous beginner to confident sparring partner in just a few months.`,
      student: 'Omar H.',
      rank: 'INTERMEDIATE',
      avatar: AVATARS[2],
      rating: 5,
    },
    {
      id: `${coach.id}-spotlight-3`,
      headline: 'Worth every session',
      quote: `The coaching quality at 971 MMA is elite, and ${coachFirstName} is a big reason why. Clear cues, real corrections, and genuine care for every student's progress.`,
      student: 'Emily W.',
      rank: 'MEMBER',
      avatar: AVATARS[3],
      rating: 5,
    },
  ];
}
