-- Expand admin_update_coach so the admin panel can edit full coach profile
-- (story sections, years, nickname, certifications, etc.).
-- Also relax curated-field protection so only true NULLs are blocked
-- (Mindbody wipe), while admin can clear fields via empty string / [].

create or replace function public.protect_coach_curated_fields()
returns trigger
language plpgsql
as $$
begin
  -- Admin RPC sets this local flag so intentional clears are allowed.
  if current_setting('app.admin_coach_update', true) = '1' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Only block NULL overwrites (typical Mindbody upsert wipe).
    if new.photo_url is null and old.photo_url is not null then
      new.photo_url := old.photo_url;
    end if;
    if new.specialty is null and old.specialty is not null then
      new.specialty := old.specialty;
    end if;
    if new.rank is null and old.rank is not null then
      new.rank := old.rank;
    end if;
    if new.rating is null and old.rating is not null then
      new.rating := old.rating;
    end if;
    if new.status_achievements is null and old.status_achievements is not null then
      new.status_achievements := old.status_achievements;
    end if;
    if new.experience_highlights is null and old.experience_highlights is not null then
      new.experience_highlights := old.experience_highlights;
    end if;
    if new.coaching_style is null and old.coaching_style is not null then
      new.coaching_style := old.coaching_style;
    end if;
  end if;
  return new;
end;
$$;

drop function if exists public.admin_update_coach(uuid, text, text, text, numeric, text, text, boolean, int, boolean);
drop function if exists public.admin_update_coach(uuid, text, text, text, numeric, text, text, boolean, int);
drop function if exists public.admin_update_coach(uuid, text, text, numeric, text, text, boolean, int);

create or replace function public.admin_update_coach(
  p_coach_id uuid,
  p_name text default null,
  p_specialty text default null,
  p_rank text default null,
  p_rating numeric default null,
  p_set_rating boolean default false,
  p_bio text default null,
  p_photo_url text default null,
  p_is_head_coach boolean default null,
  p_sort_order int default null,
  p_visible_in_app boolean default null,
  p_nickname text default null,
  p_coaching_philosophy text default null,
  p_years_experience int default null,
  p_set_years_experience boolean default false,
  p_years_martial_arts int default null,
  p_set_years_martial_arts boolean default false,
  p_years_coaching int default null,
  p_set_years_coaching boolean default false,
  p_fight_record text default null,
  p_invite_blurb text default null,
  p_status_achievements jsonb default null,
  p_experience_highlights jsonb default null,
  p_coaching_style jsonb default null,
  p_titles jsonb default null,
  p_certifications jsonb default null,
  p_languages text[] default null
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
  perform set_config('app.admin_coach_update', '1', true);

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

  if p_set_rating and p_rating is not null and (p_rating < 0 or p_rating > 5) then
    raise exception using message = 'INVALID_RATING', errcode = 'P0001';
  end if;

  if p_name is not null and length(trim(p_name)) = 0 then
    raise exception using message = 'INVALID_NAME', errcode = 'P0001';
  end if;

  if p_set_years_experience and p_years_experience is not null and p_years_experience < 0 then
    raise exception using message = 'INVALID_YEARS', errcode = 'P0001';
  end if;
  if p_set_years_martial_arts and p_years_martial_arts is not null and p_years_martial_arts < 0 then
    raise exception using message = 'INVALID_YEARS', errcode = 'P0001';
  end if;
  if p_set_years_coaching and p_years_coaching is not null and p_years_coaching < 0 then
    raise exception using message = 'INVALID_YEARS', errcode = 'P0001';
  end if;

  update public.coaches
  set name = coalesce(nullif(trim(p_name), ''), name),
      specialty = case when p_specialty is null then specialty else nullif(trim(p_specialty), '') end,
      rank = case when p_rank is null then rank else nullif(trim(p_rank), '') end,
      rating = case when p_set_rating then p_rating else rating end,
      bio = case when p_bio is null then bio else nullif(trim(p_bio), '') end,
      photo_url = case when p_photo_url is null then photo_url else nullif(trim(p_photo_url), '') end,
      is_head_coach = coalesce(p_is_head_coach, is_head_coach),
      sort_order = coalesce(p_sort_order, sort_order),
      visible_in_app = coalesce(p_visible_in_app, visible_in_app),
      nickname = case when p_nickname is null then nickname else nullif(trim(p_nickname), '') end,
      coaching_philosophy = case
        when p_coaching_philosophy is null then coaching_philosophy
        else nullif(trim(p_coaching_philosophy), '')
      end,
      years_experience = case when p_set_years_experience then p_years_experience else years_experience end,
      years_martial_arts = case when p_set_years_martial_arts then p_years_martial_arts else years_martial_arts end,
      years_coaching = case when p_set_years_coaching then p_years_coaching else years_coaching end,
      fight_record = case when p_fight_record is null then fight_record else nullif(trim(p_fight_record), '') end,
      invite_blurb = case when p_invite_blurb is null then invite_blurb else nullif(trim(p_invite_blurb), '') end,
      status_achievements = coalesce(p_status_achievements, status_achievements),
      experience_highlights = coalesce(p_experience_highlights, experience_highlights),
      coaching_style = coalesce(p_coaching_style, coaching_style),
      titles = coalesce(p_titles, titles),
      certifications = coalesce(p_certifications, certifications),
      languages = coalesce(p_languages, languages),
      updated_at = now()
  where id = p_coach_id
  returning * into v_coach;

  v_changes := jsonb_strip_nulls(
    jsonb_build_object(
      'name', p_name,
      'specialty', p_specialty,
      'rank', p_rank,
      'rating', case when p_set_rating then to_jsonb(p_rating) else null end,
      'bio', case when p_bio is not null then left(p_bio, 120) else null end,
      'photoUrl', p_photo_url,
      'isHeadCoach', p_is_head_coach,
      'sortOrder', p_sort_order,
      'visibleInApp', p_visible_in_app,
      'nickname', p_nickname,
      'yearsExperience', case when p_set_years_experience then to_jsonb(p_years_experience) else null end,
      'yearsMartialArts', case when p_set_years_martial_arts then to_jsonb(p_years_martial_arts) else null end,
      'yearsCoaching', case when p_set_years_coaching then to_jsonb(p_years_coaching) else null end,
      'statusAchievements', p_status_achievements,
      'experienceHighlights', p_experience_highlights,
      'coachingStyle', p_coaching_style
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

grant execute on function public.admin_update_coach(
  uuid, text, text, text, numeric, boolean, text, text, boolean, int, boolean,
  text, text, int, boolean, int, boolean, int, boolean, text, text,
  jsonb, jsonb, jsonb, jsonb, jsonb, text[]
) to authenticated;
