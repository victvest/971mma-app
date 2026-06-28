-- Academy coach directory: curated from https://971mma.com/coaches/
-- Mindbody staff are not instructors; the member app and admin use this table instead.

alter table public.coaches
  add column if not exists slug text;

create unique index if not exists idx_coaches_slug
  on public.coaches (slug);

-- Drop legacy Mindbody staff mirror rows (no stable academy slug).
delete from public.coaches
where slug is null;

insert into public.coaches (
  slug,
  name,
  specialty,
  rank,
  bio,
  photo_url,
  is_head_coach,
  sort_order,
  mindbody_staff_id,
  last_synced_at
)
values
  (
    'rogerio-alves-luz',
    'Rogerio Alves Luz',
    'Brazilian Jiu-Jitsu',
    'Head BJJ Coach & Personal Trainer',
    'Born in Manaus, Brazil — the global heart of BJJ. ACBJJ World Champion, Grand Slam Champion (China), AJP World Pro Qualifier Champion 2024, Top-10 in the world (69kg, Black Belt, AJP). Competed in 16 countries.',
    'https://971mma.com/wp-content/uploads/2025/11/IMG_8980-scaled-e1765195442468.jpeg',
    true,
    10,
    null,
    null
  ),
  (
    'joe-gerrard',
    'Joe Gerrard',
    'Youth Programs',
    'Kids Coach & Personal Trainer',
    'Trained for nearly 10 years with a focus on MMA and Brazilian Jiu-Jitsu. Currently a purple belt, Joe creates a fun and structured environment where kids build confidence, discipline, and fitness.',
    'https://971mma.com/wp-content/uploads/2025/11/IMG_8981-scaled-e1765201044500.jpeg',
    false,
    20,
    null,
    null
  ),
  (
    'carl-booth',
    'Carl Booth',
    'Muay Thai / K1',
    'Muay Thai & K1 Coach | Combat Sports Specialist',
    'Teaches Muay Thai and K1 Kickboxing in group classes. A combat sports specialist with extensive competition experience, bringing world-class striking expertise to every session at 971 MMA.',
    'https://971mma.com/wp-content/uploads/2025/11/DSC00060-scaled-e1770027601415.jpg',
    false,
    30,
    null,
    null
  ),
  (
    'wellington-pereira',
    'Wellington Pereira',
    'Mixed Martial Arts',
    'Head MMA Coach & Personal Trainer',
    'Strong international methodology. Wellington leads the MMA program with a comprehensive approach to combat sports, drawing from his background in striking, wrestling, and grappling.',
    'https://971mma.com/wp-content/uploads/2025/11/IMG_8974-scaled-e1765193614384.jpeg',
    false,
    40,
    null,
    null
  ),
  (
    'ahmad-al-bouti',
    'Ahmad Al Bouti',
    'Mixed Martial Arts',
    'MMA Trainer & Personal Trainer',
    'Smart & technical training focusing on efficient movement. Ahmad combines technical MMA coaching with personalized fitness programming, helping athletes and beginners alike reach their full potential.',
    'https://971mma.com/wp-content/uploads/2025/11/IMG_8977-scaled-e1765201436799.jpeg',
    false,
    50,
    null,
    null
  ),
  (
    'mohammadali-geraei',
    'Mohammadali Geraei',
    'Wrestling',
    'Freestyle Wrestling Coach & Personal Trainer',
    'Main sport: Freestyle Wrestling. A specialist who brings international-level wrestling technique and conditioning to the 971 MMA training floor, working with athletes of all levels.',
    'https://971mma.com/wp-content/uploads/2026/01/IMG_9522-scaled-e1768242870425.jpeg',
    false,
    60,
    null,
    null
  ),
  (
    'leandro-castro-monteiro',
    'Leandro Castro Monteiro',
    'Brazilian Jiu-Jitsu',
    'Brazilian Jiu-Jitsu Coach | 3rd Degree Black Belt',
    '3rd-degree black belt in Brazilian Jiu-Jitsu. Expert in coaching both children and adults, Leandro is one of the most decorated BJJ coaches in the UAE with decades of competition and coaching experience.',
    'https://971mma.com/wp-content/uploads/2026/01/IMG_9528-scaled-e1768243824457.jpeg',
    false,
    70,
    null,
    null
  )
on conflict (slug) do update
set name = excluded.name,
    specialty = excluded.specialty,
    rank = excluded.rank,
    bio = excluded.bio,
    photo_url = excluded.photo_url,
    is_head_coach = excluded.is_head_coach,
    sort_order = excluded.sort_order;

create or replace function public.admin_update_coach(
  p_coach_id uuid,
  p_name text default null,
  p_specialty text default null,
  p_rank text default null,
  p_rating numeric default null,
  p_bio text default null,
  p_photo_url text default null,
  p_is_head_coach boolean default null,
  p_sort_order int default null
)
returns public.coaches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach public.coaches%rowtype;
  v_changes jsonb := '{}'::jsonb;
begin
  perform public.require_admin();

  if p_coach_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select *
    into v_coach
  from public.coaches
  where id = p_coach_id
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if p_rating is not null and (p_rating < 0 or p_rating > 5) then
    raise exception using message = 'INVALID_RATING', errcode = 'P0001';
  end if;

  if p_name is not null and length(trim(p_name)) = 0 then
    raise exception using message = 'INVALID_NAME', errcode = 'P0001';
  end if;

  update public.coaches
  set name = coalesce(nullif(trim(p_name), ''), name),
      specialty = coalesce(p_specialty, specialty),
      rank = coalesce(p_rank, rank),
      rating = coalesce(p_rating, rating),
      bio = coalesce(p_bio, bio),
      photo_url = coalesce(p_photo_url, photo_url),
      is_head_coach = coalesce(p_is_head_coach, is_head_coach),
      sort_order = coalesce(p_sort_order, sort_order)
  where id = p_coach_id
  returning * into v_coach;

  v_changes := jsonb_strip_nulls(
    jsonb_build_object(
      'name', p_name,
      'specialty', p_specialty,
      'rank', p_rank,
      'rating', p_rating,
      'bio', case when p_bio is not null then left(p_bio, 120) else null end,
      'photoUrl', p_photo_url,
      'isHeadCoach', p_is_head_coach,
      'sortOrder', p_sort_order
    )
  );

  perform public.write_admin_audit(
    'update_coach',
    'coaches',
    p_coach_id::text,
    v_changes
  );

  return v_coach;
end;
$$;
