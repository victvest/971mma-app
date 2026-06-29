-- Demo enrichment: coach profile fields, discipline links, and rolling upcoming classes.
-- Safe to re-run refresh via public.refresh_demo_class_schedule().

-- ── 1. Enrich academy coach profiles ─────────────────────────────────────────

update public.coaches as c
set
  rating = v.rating,
  coaching_philosophy = v.coaching_philosophy,
  years_experience = v.years_experience,
  fight_record = v.fight_record,
  titles = v.titles,
  certifications = v.certifications,
  languages = v.languages
from (
  values
    (
      'rogerio-alves-luz',
      4.9::numeric,
      'Technique first, pressure always. Every roll is a chance to sharpen fundamentals and build a game that works under competition stress.',
      18,
      'Competition record: 120+ IBJJF & AJP matches across 16 countries.',
      '["ACBJJ World Champion", "AJP Grand Slam Champion", "AJP World Pro Qualifier Champion 2024", "Top-10 AJP Black Belt (69kg)"]'::jsonb,
      '["IBJJF Certified Coach", "First Aid & CPR", "UAE Personal Training License"]'::jsonb,
      array['English', 'Portuguese', 'Arabic']
    ),
    (
      'joe-gerrard',
      4.8::numeric,
      'Kids learn best when training feels like play with clear structure. Confidence, respect, and consistency come before competition.',
      10,
      null,
      '["Kids Program Lead — 971 MMA", "Youth MMA Development Specialist"]'::jsonb,
      '["Kids Coaching Certification", "Safeguarding & Child Welfare", "First Aid & CPR"]'::jsonb,
      array['English']
    ),
    (
      'carl-booth',
      4.7::numeric,
      'Striking is rhythm, timing, and discipline. Build sharp technique in pad work, then pressure-test it in controlled sparring.',
      14,
      'Professional Muay Thai & K1 record across UK and UAE promotions.',
      '["UK Muay Thai Champion", "K1 Regional Title Holder", "971 MMA Striking Program Lead"]'::jsonb,
      '["Muay Thai Instructor Certification", "Pad Holding Specialist", "First Aid & CPR"]'::jsonb,
      array['English']
    ),
    (
      'wellington-pereira',
      4.8::numeric,
      'MMA is integration — stand up, clinch, wrestle, finish. Train all phases with purpose so athletes are ready for any scenario.',
      16,
      'Professional MMA record with wins across regional and international cards.',
      '["Professional MMA Fighter", "971 MMA Head MMA Coach", "Combat Sports Conditioning Specialist"]'::jsonb,
      '["MMA Coaching Certification", "Strength & Conditioning Level 1", "First Aid & CPR"]'::jsonb,
      array['English', 'Portuguese']
    ),
    (
      'ahmad-al-bouti',
      4.9::numeric,
      'Efficient movement beats wasted effort. Technical precision and smart conditioning help every athlete progress faster with less burnout.',
      12,
      'Amateur MMA record with multiple regional podium finishes.',
      '["971 MMA Performance Coach", "Technical MMA Specialist"]'::jsonb,
      '["Personal Training License (UAE)", "Sports Nutrition Fundamentals", "First Aid & CPR"]'::jsonb,
      array['English', 'Arabic']
    ),
    (
      'mohammadali-geraei',
      4.7::numeric,
      'Wrestling is the foundation of control. Master stance, level changes, and mat returns — then everything else in MMA gets easier.',
      15,
      'International freestyle wrestling competitor; multiple national-team training camps.',
      '["Freestyle Wrestling National Team Experience", "971 MMA Wrestling Program Lead"]'::jsonb,
      '["Freestyle Wrestling Coach Certification", "Olympic Lifting Fundamentals", "First Aid & CPR"]'::jsonb,
      array['English', 'Persian', 'Arabic']
    ),
    (
      'leandro-castro-monteiro',
      4.9::numeric,
      'Jiu-jitsu is a lifelong journey. Teach positions with clarity, roll with intention, and help every student find their own expression on the mat.',
      22,
      'IBJJF black belt competitor with decades of coaching across Brazil and the UAE.',
      '["3rd Degree BJJ Black Belt", "Multiple IBJJF Medalist", "971 MMA BJJ Program Coach"]'::jsonb,
      '["IBJJF Certified Coach", "Kids BJJ Specialist", "First Aid & CPR"]'::jsonb,
      array['English', 'Portuguese', 'Spanish']
    )
) as v(slug, rating, coaching_philosophy, years_experience, fight_record, titles, certifications, languages)
where c.slug = v.slug;

-- ── 2. Link coaches to disciplines ───────────────────────────────────────────

insert into public.coach_disciplines (coach_id, discipline_id)
select c.id, d.id
from (
  values
    ('rogerio-alves-luz', 'bjj'),
    ('joe-gerrard', 'bjj'),
    ('joe-gerrard', 'mma'),
    ('carl-booth', 'muay_thai'),
    ('wellington-pereira', 'mma'),
    ('ahmad-al-bouti', 'mma'),
    ('ahmad-al-bouti', 'performance_fitness'),
    ('mohammadali-geraei', 'wrestling'),
    ('leandro-castro-monteiro', 'bjj')
) as mapping(coach_slug, discipline_slug)
join public.coaches c on c.slug = mapping.coach_slug
join public.disciplines d on d.slug = mapping.discipline_slug
on conflict (coach_id, discipline_id) do nothing;

-- ── 3. Rolling demo class schedule (today + tomorrow, Asia/Dubai) ────────────

create or replace function public.refresh_demo_class_schedule()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_tomorrow date := v_today + 1;
begin
  delete from public.classes
  where mindbody_class_id like 'demo-seed-%';

  insert into public.classes (
    mindbody_class_id,
    title,
    discipline,
    discipline_id,
    description,
    coach_name,
    coach_id,
    starts_at,
    duration_minutes,
    capacity,
    booked_count,
    level,
    is_available,
    is_waitlist_available,
    is_cancelled
  )
  select
    'demo-seed-' || t.coach_slug || '-' || t.slot_key,
    t.title,
    d.display_name,
    d.id,
    t.description,
    c.name,
    c.id,
    ((case when t.day_offset = 0 then v_today else v_tomorrow end + t.start_time) at time zone 'Asia/Dubai'),
    t.duration_minutes,
    t.capacity,
    t.booked_count,
    t.level,
    t.booked_count < t.capacity,
    t.booked_count >= t.capacity,
    false
  from (
    values
      -- Rogerio · BJJ
      ('rogerio-alves-luz', 'bjj', 'today-am-gi', 0, time '10:00', 'Gi Fundamentals', 'Build a strong foundation in grips, posture, and core positions. Ideal for white and blue belts building consistent mat habits.', 'All Levels', 90, 24, 18),
      ('rogerio-alves-luz', 'bjj', 'today-pm-adv', 0, time '19:00', 'Advanced Gi', 'High-intensity positional sparring and competition-specific chains for purple belts and above.', 'Advanced', 90, 20, 16),
      ('rogerio-alves-luz', 'bjj', 'tomorrow-comp', 1, time '11:00', 'Competition Drilling', 'Takedown entries, guard passing sequences, and situational rounds for athletes preparing for tournaments.', 'Intermediate', 90, 22, 12),
      -- Joe · Youth
      ('joe-gerrard', 'bjj', 'today-kids-am', 0, time '09:00', 'Kids BJJ (Ages 6–8)', 'Fun, structured introduction to jiu-jitsu with games, basic positions, and mat etiquette for young beginners.', 'Kids', 60, 16, 11),
      ('joe-gerrard', 'mma', 'today-kids-pm', 0, time '16:00', 'Kids MMA Fundamentals', 'Safe striking pads, basic wrestling entries, and team drills that build coordination and confidence.', 'Kids', 60, 16, 13),
      ('joe-gerrard', 'bjj', 'tomorrow-kids', 1, time '09:00', 'Kids BJJ (Ages 9–12)', 'Expanded technique library with controlled sparring for developing youth athletes.', 'Kids', 60, 18, 9),
      -- Carl · Striking
      ('carl-booth', 'muay_thai', 'today-fund', 0, time '12:00', 'Muay Thai Fundamentals', 'Stance, footwork, teep, and basic combinations on pads. Perfect for beginners and returning strikers.', 'All Levels', 60, 22, 17),
      ('carl-booth', 'muay_thai', 'today-k1', 0, time '18:00', 'K1 Conditioning', 'High-energy pad rounds, bag work, and fight-specific conditioning to sharpen your striking engine.', 'Intermediate', 60, 20, 19),
      ('carl-booth', 'muay_thai', 'tomorrow-spar', 1, time '17:00', 'Muay Thai Sparring', 'Controlled sparring with coach supervision. Mouthguard and shin guards required.', 'Advanced', 75, 16, 14),
      -- Wellington · MMA
      ('wellington-pereira', 'mma', 'today-tech', 0, time '11:30', 'MMA Technical', 'Integrated striking-to-grappling chains, cage awareness, and round structure for well-rounded MMA athletes.', 'Intermediate', 90, 24, 20),
      ('wellington-pereira', 'mma', 'today-spar', 0, time '20:00', 'MMA Sparring', 'MMA-specific sparring rounds with mandatory safety equipment. Coach approval required for new athletes.', 'Advanced', 90, 18, 15),
      ('wellington-pereira', 'mma', 'tomorrow-wrest', 1, time '12:30', 'MMA Wrestling for MMA', 'Takedown entries, cage wrestling, and mat returns tailored for mixed rules competition.', 'All Levels', 75, 22, 10),
      -- Ahmad · MMA + Fitness
      ('ahmad-al-bouti', 'mma', 'today-fund', 0, time '08:00', 'MMA Fundamentals', 'Clean mechanics for striking, clinch, and ground transitions. Beginner-friendly with progressive intensity.', 'Beginner', 75, 24, 14),
      ('ahmad-al-bouti', 'performance_fitness', 'today-fit', 0, time '17:30', 'Combat Athlete Conditioning', 'Strength circuits, mobility, and energy-system work designed for fighters and general fitness members.', 'All Levels', 60, 20, 16),
      ('ahmad-al-bouti', 'mma', 'tomorrow-tech', 1, time '18:30', 'MMA Flow Drills', 'Partner drills linking strikes, entries, and submissions at moderate pace for skill consolidation.', 'Intermediate', 75, 22, 11),
      -- Mohammadali · Wrestling
      ('mohammadali-geraei', 'wrestling', 'today-fund', 0, time '07:30', 'Freestyle Wrestling Fundamentals', 'Stance, motion, level changes, and basic takedowns. No experience required.', 'All Levels', 75, 20, 12),
      ('mohammadali-geraei', 'wrestling', 'today-live', 0, time '19:30', 'Wrestling Live Rounds', 'Situational wrestling and live go rounds with emphasis on mat returns and control.', 'Intermediate', 75, 18, 17),
      ('mohammadali-geraei', 'wrestling', 'tomorrow-clinic', 1, time '10:30', 'Takedown Clinic', 'Deep dive on double-leg, single-leg, and chain wrestling for BJJ and MMA athletes.', 'All Levels', 90, 22, 8),
      -- Leandro · BJJ
      ('leandro-castro-monteiro', 'bjj', 'today-nogi', 0, time '13:00', 'No-Gi Fundamentals', 'Wrestling-up connections, front headlock systems, and leg-entangle awareness for no-gi practitioners.', 'All Levels', 90, 24, 19),
      ('leandro-castro-monteiro', 'bjj', 'today-adv', 0, time '20:30', 'No-Gi Advanced', 'High-level passing, back takes, and submission chains for experienced grapplers.', 'Advanced', 90, 18, 16),
      ('leandro-castro-monteiro', 'bjj', 'tomorrow-open', 1, time '10:00', 'Open Mat — No-Gi', 'Open rolling with coach supervision. Drop in, work your game, and get feedback between rounds.', 'All Levels', 120, 30, 12)
  ) as t(
    coach_slug,
    discipline_slug,
    slot_key,
    day_offset,
    start_time,
    title,
    description,
    level,
    duration_minutes,
    capacity,
    booked_count
  )
  join public.coaches c on c.slug = t.coach_slug
  join public.disciplines d on d.slug = t.discipline_slug;
end;
$$;

revoke all on function public.refresh_demo_class_schedule() from public;
grant execute on function public.refresh_demo_class_schedule() to service_role;

select public.refresh_demo_class_schedule();
