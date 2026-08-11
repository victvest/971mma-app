-- Restore curated coach photos / specialty / rank wiped by mb-staff upsert
-- (deployed edge function was still nulling those columns on sync).
-- Also protect curated fields from future null overwrites.

update public.coaches
set
  specialty = 'Brazilian Jiu-Jitsu',
  rank = 'Head BJJ Coach',
  is_head_coach = true,
  photo_url = 'https://971mma.com/wp-content/uploads/2025/11/IMG_8980-scaled-e1765195442468.jpeg',
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Rogerio Alves%';

update public.coaches
set
  specialty = 'Brazilian Jiu-Jitsu',
  rank = 'BJJ Coach',
  nickname = coalesce(nullif(trim(nickname), ''), 'Wagner'),
  -- No academy website portrait; app uses bundled local asset.
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Wagner Gabriel%';

update public.coaches
set
  specialty = 'Mixed Martial Arts',
  rank = 'MMA Teens / MMA / Fitness Coach',
  photo_url = 'https://971mma.com/wp-content/uploads/2025/11/IMG_8977-scaled-e1765201436799.jpeg',
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Ahmad%Bouti%';

update public.coaches
set
  specialty = 'Mixed Martial Arts',
  rank = 'Head MMA Coach',
  is_head_coach = true,
  photo_url = 'https://971mma.com/wp-content/uploads/2025/11/IMG_8974-scaled-e1765193614384.jpeg',
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Wellington Pereira%';

update public.coaches
set
  specialty = 'Wrestling',
  rank = 'Head Coach Freestyle Wrestling',
  is_head_coach = true,
  photo_url = 'https://971mma.com/wp-content/uploads/2026/01/IMG_9522-scaled-e1768242870425.jpeg',
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Mohammadali Geraei%';

update public.coaches
set
  specialty = 'Youth Programs',
  rank = 'Kids Coach',
  photo_url = 'https://971mma.com/wp-content/uploads/2025/11/IMG_8981-scaled-e1765201044500.jpeg',
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and (
    name ilike 'Joseph Gerrard%'
    or name ilike 'Joe Gerrard%'
  );

update public.coaches
set
  specialty = 'Muay Thai / K1',
  rank = 'Muay Thai Coach',
  photo_url = 'https://971mma.com/wp-content/uploads/2025/11/DSC00060-scaled-e1770027601415.jpg',
  updated_at = now()
where mindbody_staff_id is not null
  and deleted_at is null
  and name ilike 'Carl Booth%';

update public.coaches
set
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

-- Prevent Mindbody sync (or any update) from clearing curated directory fields.
create or replace function public.protect_coach_curated_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.photo_url is null and old.photo_url is not null then
      new.photo_url := old.photo_url;
    end if;
    if nullif(trim(new.specialty), '') is null and nullif(trim(old.specialty), '') is not null then
      new.specialty := old.specialty;
    end if;
    if nullif(trim(new.rank), '') is null and nullif(trim(old.rank), '') is not null then
      new.rank := old.rank;
    end if;
    if new.rating is null and old.rating is not null then
      new.rating := old.rating;
    end if;
    if coalesce(jsonb_typeof(new.status_achievements), 'null') = 'array'
       and jsonb_array_length(coalesce(new.status_achievements, '[]'::jsonb)) = 0
       and jsonb_array_length(coalesce(old.status_achievements, '[]'::jsonb)) > 0 then
      new.status_achievements := old.status_achievements;
    end if;
    if coalesce(jsonb_typeof(new.experience_highlights), 'null') = 'array'
       and jsonb_array_length(coalesce(new.experience_highlights, '[]'::jsonb)) = 0
       and jsonb_array_length(coalesce(old.experience_highlights, '[]'::jsonb)) > 0 then
      new.experience_highlights := old.experience_highlights;
    end if;
    if coalesce(jsonb_typeof(new.coaching_style), 'null') = 'array'
       and jsonb_array_length(coalesce(new.coaching_style, '[]'::jsonb)) = 0
       and jsonb_array_length(coalesce(old.coaching_style, '[]'::jsonb)) > 0 then
      new.coaching_style := old.coaching_style;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_coach_curated_fields on public.coaches;
create trigger trg_protect_coach_curated_fields
  before update on public.coaches
  for each row
  execute function public.protect_coach_curated_fields();
