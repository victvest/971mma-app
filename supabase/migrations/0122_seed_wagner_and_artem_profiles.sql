-- Seed Wagner Gabriel Silva from Instagram coach stories (was missing from 0121).
-- Also ensure Artem (visible in app, no story reel) has baseline specialty/rank.

-- Wagner Gabriel Silva — BJJ coach (nickname Wagner)
update public.coaches
set
  nickname = 'Wagner',
  rating = 4.7,
  specialty = 'Brazilian Jiu-Jitsu',
  rank = 'BJJ Coach',
  years_martial_arts = 11,
  years_coaching = 5,
  years_experience = 5,
  status_achievements = '[
    "IBJJF national champion",
    "Multiple times #1 in national ranking",
    "Multiple AJP and IBJJF competition medals across Brazil"
  ]'::jsonb,
  experience_highlights = '[
    "11 years of martial arts experience",
    "5 years working professionally as a coach, leading and developing athletes",
    "Coach in Manaus — children and adults",
    "Coaching experience in Brazil",
    "Trained students from beginners to world-level competitors"
  ]'::jsonb,
  coaching_style = '[
    "Clear and effective technical instruction",
    "Strong focus on takedowns, pressure passing, and top-control systems — spider guards and berimbolos",
    "Structured training with purposeful drills",
    "Teaching rooted in honor, respect, discipline, and mental strength",
    "Supportive and motivating environment for safe, consistent evolution"
  ]'::jsonb,
  invite_blurb = 'The jiu-jitsu and grappling coach is waiting for you at personal training sessions for athletes of all levels and genders.',
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Wagner Gabriel%';

-- Artem Dotsenko — visible Mindbody coach; boxing coach in Dubai (no Instagram story reel).
update public.coaches
set
  rating = coalesce(rating, 4.8),
  specialty = 'Boxing',
  rank = 'Boxing Coach',
  bio = coalesce(
    nullif(trim(bio), ''),
    'Boxing coach at 971 MMA & Fitness Academy — technique, pads, and conditioning for all levels.'
  ),
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Artem Dotsenko%';
