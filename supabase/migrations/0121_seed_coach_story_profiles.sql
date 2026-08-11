-- Seed story profile sections, ratings, specialties, and academy photos
-- onto the live Mindbody-synced coach rows (matched by name).
-- Prior seed used old academy slugs (rogerio-alves-luz, …) that no longer exist
-- after 0107_reset_coaches_for_mindbody.

-- Rogerio Alves Filho (Mindbody) ≈ Rogerio Alves Luz stories
update public.coaches
set
  rating = 5.0,
  specialty = 'Brazilian Jiu-Jitsu',
  rank = 'Head BJJ Coach',
  is_head_coach = true,
  years_martial_arts = 21,
  years_coaching = 8,
  years_experience = 8,
  photo_url = 'https://971mma.com/wp-content/uploads/2025/11/IMG_8980-scaled-e1765195442468.jpeg',
  status_achievements = '[
    "ACBJJ World Champion (Moscow)",
    "Grand Slam Champion (China)",
    "AJP World Pro Qualifier Champion 2024",
    "AJP World Pro Finalist 2025",
    "Top-10 in the world (69kg, Black Belt, AJP)",
    "Multiple medals across IBJJF, ACBJJ, AJP",
    "Competed in 16 countries"
  ]'::jsonb,
  experience_highlights = '[
    "21 years of martial arts experience",
    "8 years of professional coaching",
    "Head Coach of the Kazakhstan & Kyrgyzstan National Teams",
    "Recognized by the Government of Dagestan for excellence in coaching",
    "Conducted seminars in 10 countries"
  ]'::jsonb,
  coaching_style = '[
    "Clear and detailed technical instruction",
    "Pressure passing and top control systems",
    "Structured, purposeful training",
    "Focus on discipline, respect, and mental strength"
  ]'::jsonb,
  invite_blurb = 'The coach is waiting for you at group Jiu-Jitsu and grappling classes for all ages, levels, and genders — as well as private training, including competition preparation.',
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Rogerio Alves%';

-- Ahmad Bouti (Mindbody) ≈ Ahmad Al Bouti stories
update public.coaches
set
  rating = 4.7,
  specialty = 'Mixed Martial Arts',
  rank = 'MMA Teens / MMA / Fitness Coach',
  years_coaching = 7,
  years_experience = 7,
  photo_url = 'https://971mma.com/wp-content/uploads/2025/11/IMG_8977-scaled-e1765201436799.jpeg',
  status_achievements = '[
    "Active competitor MMA and Brazilian Jiu-Jitsu in the UAE",
    "Competed internationally in Turkey and Jordan",
    "Participated in multiple UAE Jiu-Jitsu Federation championships",
    "Experience in both Gi & No-Gi competition preparation",
    "Trained with top coaches and professional fighters globally"
  ]'::jsonb,
  experience_highlights = '[
    "7+ years of coaching and athletic development",
    "Built complete athletes from beginners to competition level",
    "Successfully prepared students for BJJ, MMA & striking tournaments",
    "Expert in weight cutting, speed development & mobility enhancement",
    "Bachelor''s degree in Physical Education (4 years)",
    "Master''s degree in Nutrition & Dietetics",
    "Certified Fitness & Strength Conditioning Coach"
  ]'::jsonb,
  coaching_style = '[
    "Smart & technical training focusing on efficient movement",
    "Confidence-building + mental toughness coaching",
    "Detailed correction, individualized approach & fight IQ development",
    "High-energy sessions based on real fight experience",
    "Progression with injury prevention as a top priority"
  ]'::jsonb,
  invite_blurb = 'Our coach invites you to join group MMA training for teens and adults, as well as fitness sessions for those who want to get in great shape and learn mixed martial arts.',
  certifications = '[
    "Bachelor''s degree in Physical Education",
    "Master''s degree in Nutrition & Dietetics",
    "Certified Fitness & Strength Conditioning Coach"
  ]'::jsonb,
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Ahmad%Bouti%';

-- Wellington Pereira
update public.coaches
set
  rating = 4.9,
  specialty = 'Mixed Martial Arts',
  rank = 'Head MMA Coach',
  is_head_coach = true,
  years_coaching = 12,
  years_experience = 12,
  photo_url = 'https://971mma.com/wp-content/uploads/2025/11/IMG_8974-scaled-e1765193614384.jpeg',
  status_achievements = '[
    "International ISKA Champion (Kickboxing)",
    "Brazilian MMA Champion",
    "International MMA Champion",
    "Brazilian Champion: Muay Thai / Brazilian Jiu-Jitsu / Boxing",
    "Professional athlete since 2015"
  ]'::jsonb,
  experience_highlights = '[
    "Black Belt in Kickboxing and Brazilian Jiu-Jitsu",
    "12+ years of professional coaching experience",
    "Worked internationally in Brazil, Russia, and Kazakhstan",
    "Head MMA Coach at 971 MMA & Fitness Academy",
    "Works with all levels, from complete beginners to elite and professional athletes",
    "Special focus on physical conditioning, strength, endurance, and fight-specific preparation"
  ]'::jsonb,
  coaching_style = '[
    "Highly structured and disciplined training system",
    "Clear, precise, and effective technical corrections",
    "Strong international methodology combining striking, grappling, and conditioning",
    "Safe, motivating, and professional training environment",
    "Results-oriented approach with attention to athlete development and longevity"
  ]'::jsonb,
  invite_blurb = 'The head MMA coach is waiting for you at group and personal training sessions, for all levels — from your first steps to professional fights.',
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Wellington Pereira%';

-- Mohammadali Geraei
update public.coaches
set
  rating = 5.0,
  specialty = 'Wrestling',
  rank = 'Head Coach Freestyle Wrestling',
  is_head_coach = true,
  photo_url = 'https://971mma.com/wp-content/uploads/2026/01/IMG_9522-scaled-e1768242870425.jpeg',
  status_achievements = '[
    "Gold Medal — World Wrestling Championships 2024 (82kg)",
    "Bronze Medal — World Wrestling Championships 2017 (71kg)",
    "Bronze Medal — World Wrestling Championships 2019 (77kg)",
    "Bronze Medal — World Wrestling Championships 2021 (77kg)",
    "Gold Medal — 2018 Asian Games (77kg)",
    "Multiple other Asian and international medals",
    "Competed under official wrestling federations"
  ]'::jsonb,
  experience_highlights = '[
    "World and Olympic championship experience",
    "Strong discipline and leadership",
    "Ability to motivate and develop a competitive mindset",
    "Safe and effective training intensity",
    "Complete focus on real progress for my students"
  ]'::jsonb,
  coaching_style = '[
    "My training approach is organized, precise, disciplined, and results-driven",
    "Programs are built on professional wrestling systems, strength, endurance, and competitive mindset development",
    "Every program is fully customized to the level and goals of each student",
    "Guides athletes from beginner to champion"
  ]'::jsonb,
  invite_blurb = 'The head wrestling coach invites athletes of all levels — from beginners to professionals — to personal and group training sessions. If you want to grow, sharpen your technique, and push beyond your limits, you''re welcome at the trainings.',
  titles = '[
    "World Wrestling Championships Gold 2024 (82kg)",
    "Asian Games Gold 2018 (77kg)",
    "World Wrestling Championships Bronze 2017 / 2019 / 2021"
  ]'::jsonb,
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Mohammadali Geraei%';

-- Joseph Gerrard (Mindbody) ≈ Joe Gerrard stories
update public.coaches
set
  rating = 4.6,
  specialty = 'Youth Programs',
  rank = 'Kids Coach',
  years_martial_arts = 10,
  years_coaching = 7,
  years_experience = 7,
  photo_url = 'https://971mma.com/wp-content/uploads/2025/11/IMG_8981-scaled-e1765201044500.jpeg',
  status_achievements = '[
    "10 years training experience",
    "BJJ Purple belt",
    "7 years coaching experience",
    "First class honours in Sport coaching"
  ]'::jsonb,
  experience_highlights = '[
    "Degree in sport coaching",
    "7+ years experience",
    "Students achieved 50+ medals at competition",
    "Conducted seminars in universities about coaching",
    "Taught in Liverpool for 7 years; been in Dubai 9 months",
    "Trained in over 20 countries"
  ]'::jsonb,
  coaching_style = '[
    "Kids — game-based learning. They learn very easily if they are enjoying themselves and want to be there",
    "Adults — make your fundamentals great. Great fundamentals is the key to win"
  ]'::jsonb,
  certifications = '["First class honours in Sport coaching", "Degree in sport coaching"]'::jsonb,
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and (
    name ilike 'Joseph Gerrard%'
    or name ilike 'Joe Gerrard%'
  );

-- Carl Booth
update public.coaches
set
  rating = 4.9,
  specialty = 'Muay Thai / K1',
  rank = 'Muay Thai Coach',
  years_coaching = 10,
  years_experience = 10,
  photo_url = 'https://971mma.com/wp-content/uploads/2025/11/DSC00060-scaled-e1770027601415.jpg',
  status_achievements = '[
    "Ultimate Gladiator K1 Grand Prix Champion",
    "Fight UK Welterweight Champion",
    "BRAVE Combat Federation Welterweight Contender",
    "Competed internationally from amateur to professional MMA main event"
  ]'::jsonb,
  experience_highlights = '[
    "Around 10 years of coaching experience",
    "Former coach for UAE National Team (IMMAF World & Asian Championships — youth and senior)",
    "Manages and coaches fighters competing in UFC / PFL / BRAVE CF / Octagon / UAE Warriors",
    "Worked closely with fighters and coaching staff from KHK MMA (Bahrain)",
    "Coached 2024 PFL MENA Champion Abdulla AlQahtani (Saudi Arabia)",
    "Currently working with UAE female MMA athlete Zamzam AlHammadi preparing for her PFL debut"
  ]'::jsonb,
  coaching_style = '[
    "Enjoyable and engaging learning environment",
    "Practical martial arts that work in real competition",
    "Emphasis on concepts, tactics, and fight IQ",
    "Focus on applying techniques under pressure"
  ]'::jsonb,
  invite_blurb = 'Our experienced coach welcomes you to Muay Thai classes for all levels — from beginners to professional fighters. Training is suitable for men and women of all ages. Group classes and personal training sessions are available.',
  titles = '[
    "Ultimate Gladiator K1 Grand Prix Champion",
    "Fight UK Welterweight Champion",
    "BRAVE CF Welterweight Contender"
  ]'::jsonb,
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Carl Booth%';

-- Artem Dotsenko — in Mindbody directory, but not covered by the Instagram story reel.
-- Set a solid baseline rating only; no invented story bullets.
update public.coaches
set
  rating = 4.8,
  specialty = coalesce(nullif(trim(specialty), ''), 'Combat Sports'),
  rank = coalesce(nullif(trim(rank), ''), 'Coach'),
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Artem Dotsenko%';
