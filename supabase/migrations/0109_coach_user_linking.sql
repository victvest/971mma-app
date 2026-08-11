-- Coach ↔ app user linking (admin-confirmed, email suggestions).

alter table public.coaches
  add column if not exists staff_email text,
  add column if not exists suggested_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists user_linked_at timestamptz,
  add column if not exists user_link_method text
    check (user_link_method is null or user_link_method in ('email', 'manual'));

create index if not exists idx_coaches_suggested_user_id
  on public.coaches (suggested_user_id)
  where suggested_user_id is not null;

create index if not exists idx_coaches_staff_email_lower
  on public.coaches (lower(trim(staff_email)))
  where staff_email is not null;

-- Recompute email-based suggestions for unlinked coaches.
create or replace function public.refresh_coach_user_suggestions()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int := 0;
begin
  update public.coaches c
  set suggested_user_id = null
  where c.user_id is null
    and c.suggested_user_id is not null
    and (
      c.staff_email is null
      or trim(c.staff_email) = ''
      or not exists (
        select 1
        from auth.users u
        join public.profiles p on p.id = u.id
        where p.id = c.suggested_user_id
          and lower(trim(u.email)) = lower(trim(c.staff_email))
          and p.role in ('coach', 'admin')
      )
    );

  with candidates as (
    select
      c.id as coach_id,
      p.id as user_id,
      row_number() over (
        partition by c.id
        order by case when p.role = 'coach' then 0 else 1 end, p.created_at
      ) as coach_rank
    from public.coaches c
    join auth.users u on lower(trim(u.email)) = lower(trim(c.staff_email))
    join public.profiles p on p.id = u.id
    where c.user_id is null
      and c.staff_email is not null
      and trim(c.staff_email) <> ''
      and c.active = true
      and c.deleted_at is null
      and p.role in ('coach', 'admin')
      and not exists (
        select 1
        from public.coaches linked
        where linked.user_id = p.id
      )
  ),
  chosen as (
    select coach_id, user_id
    from candidates
    where coach_rank = 1
  )
  update public.coaches c
  set suggested_user_id = chosen.user_id
  from chosen
  where c.id = chosen.coach_id
    and c.suggested_user_id is distinct from chosen.user_id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.refresh_coach_user_suggestions() from public;
grant execute on function public.refresh_coach_user_suggestions() to service_role;

create or replace function public.admin_refresh_coach_user_suggestions()
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return public.refresh_coach_user_suggestions();
end;
$$;

revoke all on function public.admin_refresh_coach_user_suggestions() from public;
grant execute on function public.admin_refresh_coach_user_suggestions() to authenticated;

create or replace function public.admin_get_coach_user_link(p_coach_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.require_admin();

  if p_coach_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'coachId', c.id,
    'coachName', c.name,
    'staffEmail', c.staff_email,
    'mindbodyStaffId', c.mindbody_staff_id,
    'linkedUserId', c.user_id,
    'linkedUserName', lp.full_name,
    'linkedUserEmail', lu.email::text,
    'linkedUserRole', lp.role,
    'linkedAt', c.user_linked_at,
    'linkMethod', c.user_link_method,
    'suggestedUserId', c.suggested_user_id,
    'suggestedUserName', sp.full_name,
    'suggestedUserEmail', su.email::text,
    'suggestedUserRole', sp.role,
    'emailMatch',
      c.staff_email is not null
      and su.email is not null
      and lower(trim(c.staff_email)) = lower(trim(su.email::text))
  )
    into v_result
  from public.coaches c
  left join public.profiles lp on lp.id = c.user_id
  left join auth.users lu on lu.id = c.user_id
  left join public.profiles sp on sp.id = c.suggested_user_id
  left join auth.users su on su.id = c.suggested_user_id
  where c.id = p_coach_id;

  if v_result is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

create or replace function public.admin_link_coach_user(
  p_coach_id uuid,
  p_user_id uuid,
  p_method text default 'manual'
)
returns public.coaches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach public.coaches%rowtype;
  v_profile public.profiles%rowtype;
  v_method text := coalesce(nullif(trim(p_method), ''), 'manual');
begin
  perform public.require_admin();

  if p_coach_id is null or p_user_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_method not in ('email', 'manual') then
    raise exception using message = 'INVALID_METHOD', errcode = 'P0001';
  end if;

  select *
    into v_coach
  from public.coaches
  where id = p_coach_id
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select *
    into v_profile
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception using message = 'USER_NOT_FOUND', errcode = 'P0001';
  end if;

  if v_profile.role not in ('coach', 'admin') then
    raise exception using message = 'USER_NOT_COACH_ROLE', errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.coaches other
    where other.user_id = p_user_id
      and other.id <> p_coach_id
  ) then
    raise exception using message = 'USER_ALREADY_LINKED', errcode = 'P0001';
  end if;

  update public.coaches
  set user_id = null,
      user_linked_at = null,
      user_link_method = null,
      suggested_user_id = null
  where user_id = p_user_id
    and id <> p_coach_id;

  update public.coaches
  set user_id = p_user_id,
      suggested_user_id = null,
      user_linked_at = now(),
      user_link_method = v_method
  where id = p_coach_id
  returning * into v_coach;

  perform public.write_admin_audit(
    'link_coach_user',
    'coaches',
    p_coach_id::text,
    jsonb_build_object(
      'userId', p_user_id,
      'method', v_method,
      'staffEmail', v_coach.staff_email,
      'mindbodyStaffId', v_coach.mindbody_staff_id
    )
  );

  return v_coach;
end;
$$;

create or replace function public.admin_unlink_coach_user(p_coach_id uuid)
returns public.coaches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach public.coaches%rowtype;
begin
  perform public.require_admin();

  if p_coach_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  update public.coaches
  set user_id = null,
      user_linked_at = null,
      user_link_method = null
  where id = p_coach_id
  returning * into v_coach;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.refresh_coach_user_suggestions();

  perform public.write_admin_audit(
    'unlink_coach_user',
    'coaches',
    p_coach_id::text,
    '{}'::jsonb
  );

  return v_coach;
end;
$$;

revoke all on function public.admin_get_coach_user_link(uuid) from public;
revoke all on function public.admin_link_coach_user(uuid, uuid, text) from public;
revoke all on function public.admin_unlink_coach_user(uuid) from public;

grant execute on function public.admin_get_coach_user_link(uuid) to authenticated;
grant execute on function public.admin_link_coach_user(uuid, uuid, text) to authenticated;
grant execute on function public.admin_unlink_coach_user(uuid) to authenticated;

-- Backfill suggestions for existing synced staff.
select public.refresh_coach_user_suggestions();
