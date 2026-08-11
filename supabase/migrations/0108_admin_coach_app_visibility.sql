-- Admin-controlled visibility for Mindbody-synced coaches in the member app.
-- Mindbody sync (mb-staff) must not overwrite this flag on update.

alter table public.coaches
  add column if not exists visible_in_app boolean not null default true;

comment on column public.coaches.visible_in_app is
  'When false, coach is hidden from the member app directory but remains in admin and Mindbody sync.';

create index if not exists idx_coaches_member_directory
  on public.coaches (sort_order, name)
  where visible_in_app = true
    and active = true
    and deleted_at is null
    and mindbody_staff_id is not null;

drop function if exists public.admin_update_coach(uuid, text, text, text, numeric, text, text, boolean, int);
drop function if exists public.admin_update_coach(uuid, text, text, numeric, text, text, boolean, int);

create or replace function public.admin_update_coach(
  p_coach_id uuid,
  p_name text default null,
  p_specialty text default null,
  p_rank text default null,
  p_rating numeric default null,
  p_bio text default null,
  p_photo_url text default null,
  p_is_head_coach boolean default null,
  p_sort_order int default null,
  p_visible_in_app boolean default null
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
      sort_order = coalesce(p_sort_order, sort_order),
      visible_in_app = coalesce(p_visible_in_app, visible_in_app)
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
      'sortOrder', p_sort_order,
      'visibleInApp', p_visible_in_app
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
  uuid, text, text, text, numeric, text, text, boolean, int, boolean
) to authenticated;
