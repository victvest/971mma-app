-- Fix roll call attendance trigger: allow service/migration SQL (no JWT) while blocking members.

create or replace function public.enforce_roll_call_attendance_coach_writer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Postgres / service-role writes (migrations, RPC internals) have no JWT.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;
