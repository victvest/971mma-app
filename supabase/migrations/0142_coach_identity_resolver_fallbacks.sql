-- Coach run-class access should resolve the same active Mindbody coach row that
-- the app already shows in the coach schedule, even before an admin manually
-- confirms coaches.user_id.

create or replace function public.coach_id_for_user(p_user_id uuid default auth.uid())
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_full_name text;
  v_email text;
  v_coach_id uuid;
begin
  if v_user_id is null then
    return null;
  end if;

  select nullif(trim(p.full_name), ''), nullif(trim(u.email::text), '')
    into v_full_name, v_email
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = v_user_id
    and p.role in ('coach', 'admin');

  if not found then
    return null;
  end if;

  select c.id
    into v_coach_id
  from public.coaches c
  where c.user_id = v_user_id
    and c.active = true
    and c.deleted_at is null
  order by c.is_head_coach desc, c.sort_order asc nulls last, c.name asc
  limit 1;

  if v_coach_id is not null then
    return v_coach_id;
  end if;

  select c.id
    into v_coach_id
  from public.coaches c
  where c.suggested_user_id = v_user_id
    and c.user_id is null
    and c.active = true
    and c.deleted_at is null
  order by c.is_head_coach desc, c.sort_order asc nulls last, c.name asc
  limit 1;

  if v_coach_id is not null then
    return v_coach_id;
  end if;

  if v_email is not null then
    select c.id
      into v_coach_id
    from public.coaches c
    where c.user_id is null
      and c.staff_email is not null
      and lower(trim(c.staff_email)) = lower(v_email)
      and c.active = true
      and c.deleted_at is null
    order by c.is_head_coach desc, c.sort_order asc nulls last, c.name asc
    limit 1;

    if v_coach_id is not null then
      return v_coach_id;
    end if;
  end if;

  if v_full_name is not null then
    select c.id
      into v_coach_id
    from public.coaches c
    where c.user_id is null
      and lower(regexp_replace(trim(c.name), '\s+', ' ', 'g')) =
        lower(regexp_replace(v_full_name, '\s+', ' ', 'g'))
      and c.active = true
      and c.deleted_at is null
    order by c.is_head_coach desc, c.sort_order asc nulls last, c.name asc
    limit 1;
  end if;

  return v_coach_id;
end;
$$;

revoke all on function public.coach_id_for_user(uuid) from public;
grant execute on function public.coach_id_for_user(uuid) to authenticated;
