-- Migration 0156: Refine strictly BJJ classes for Coach Youcef Haibaoui
-- Ensures only real BJJ classes appear for Youcef without Muay Thai or Wrestling

create or replace function public.coach_teaches_class(p_coach_id uuid, p_class public.classes)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    -- Special demo provision ONLY for Coach Youcef Haibaoui:
    (
      p_coach_id = 'ffd87f66-a669-456f-888e-0fed2ce590da'::uuid
      and (p_class.title ilike '%BJJ%' or p_class.title ilike '%Grappling%')
      and p_class.title not ilike '%Wrestling%'
      and p_class.title not ilike '%Muay%'
      and p_class.title not ilike '%Boxing%'
    )
    or
    -- Standard check for all other coaches (100% untouched)
    exists (
      select 1
      from public.coaches c
      where c.id = p_coach_id
        and (
          (
            c.mindbody_staff_id is not null
            and p_class.staff_mindbody_id = c.mindbody_staff_id
          )
          or (
            c.mindbody_staff_id is null
            and p_class.coach_name is not null
            and lower(trim(p_class.coach_name)) = lower(trim(c.name))
          )
          or p_class.coach_id = c.id
        )
    )
  );
$$;

revoke all on function public.coach_teaches_class(uuid, public.classes) from public;
grant execute on function public.coach_teaches_class(uuid, public.classes) to authenticated;
