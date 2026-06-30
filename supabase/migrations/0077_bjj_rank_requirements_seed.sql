-- Seed stripe requirements for BJJ ranks beyond White.
-- Curriculum is ops-managed (admin console); coaches assess members in the mobile app.

insert into public.rank_requirements (rank_level_id, stripe, title, description, requirement_type, attendance_target, sort_order)
values
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Blue'),
    1,
    '20 training days',
    'Build consistency at blue belt.',
    'attendance',
    20,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Blue'),
    1,
    'Chain attacks from guard',
    'Demonstrate a safe attack chain from closed or half guard.',
    'skill',
    null,
    1
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Blue'),
    2,
    'Guard retention assessment',
    'Recover and retain guard under moderate passing pressure.',
    'assessment',
    null,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Blue'),
    3,
    'Escape side control',
    'Reliable side-control escape with frames and hip movement.',
    'skill',
    null,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Blue'),
    4,
    'Coach approval',
    'Final blue-belt stripe review before purple candidacy.',
    'assessment',
    null,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Purple'),
    1,
    '30 training days',
    'Sustain mat time at purple belt.',
    'attendance',
    30,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Purple'),
    1,
    'Pressure passing',
    'Chain guard passes with chest-to-chest pressure and control.',
    'skill',
    null,
    1
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Purple'),
    2,
    'Competition rounds',
    'Complete supervised competition-style rounds with positional resets.',
    'assessment',
    null,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Purple'),
    3,
    'Leg lock defense',
    'Identify and defend common leg entanglements safely.',
    'skill',
    null,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Purple'),
    4,
    'Coach approval',
    'Final purple-belt stripe review before brown candidacy.',
    'assessment',
    null,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Brown'),
    1,
    '40 training days',
    'Maintain consistency at brown belt.',
    'attendance',
    40,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Brown'),
    1,
    'Advanced strategy',
    'Show deliberate game planning in positional sparring.',
    'skill',
    null,
    1
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Brown'),
    2,
    'Teaching fundamentals',
    'Lead a fundamentals segment with clear coaching cues.',
    'assessment',
    null,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Brown'),
    3,
    'Chain wrestling for BJJ',
    'Connect takedowns to dominant ground control.',
    'skill',
    null,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Brown'),
    4,
    'Coach approval',
    'Final brown-belt stripe review before black candidacy.',
    'assessment',
    null,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Black'),
    1,
    '50 training days',
    'Continue leadership on the mat at black belt.',
    'attendance',
    50,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Black'),
    1,
    'Mentorship',
    'Guide lower belts through positional rounds and feedback.',
    'skill',
    null,
    1
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Black'),
    2,
    'Curriculum delivery',
    'Deliver a structured academy curriculum segment.',
    'assessment',
    null,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Black'),
    3,
    'Academy leadership',
    'Support class flow, safety, and member development.',
    'skill',
    null,
    0
  ),
  (
    (select rl.id from public.rank_levels rl
      join public.rank_systems rs on rs.id = rl.rank_system_id
      join public.disciplines d on d.id = rs.discipline_id
      where d.slug = 'bjj' and rl.name = 'Black'),
    4,
    'Head coach review',
    'Annual black-belt stripe review with head coach.',
    'assessment',
    null,
    0
  )
on conflict (rank_level_id, stripe, title) do update
set description = excluded.description,
    requirement_type = excluded.requirement_type,
    attendance_target = excluded.attendance_target,
    sort_order = excluded.sort_order;
