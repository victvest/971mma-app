-- Remove legacy gate-tablet QR / exit-PIN surface.
--
-- Current facility access is handled by SALTO NexusOne scanning the member QR
-- pass, via salto-access-by-media / salto-access-by-member-id. Keep
-- check_ins.gate_jti as the member-pass token audit field used by SALTO.

drop function if exists public.admin_get_gate_settings();
drop function if exists public.admin_update_gate_exit_pin(text);
drop function if exists public.gate_exit_pin_status();
drop function if exists public.gate_validate_exit_pin(text);
drop function if exists public.is_gate_or_admin();

drop table if exists public.gate_exit_pin_attempts;
drop table if exists public.gate_settings;
drop table if exists public.gate_tokens;

comment on column public.check_ins.gate_jti is
  'Member QR token jti used for SALTO gate_scan audit; null for non-gate methods.';

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_old_role text;
begin
  perform public.require_admin();

  if p_user_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if p_role is null or p_role not in ('member', 'coach', 'admin', 'guest') then
    raise exception using message = 'INVALID_ROLE', errcode = 'P0001';
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception using message = 'CANNOT_DEMOTE_SELF', errcode = 'P0001';
  end if;

  select *
    into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  v_old_role := v_profile.role;

  update public.profiles
  set role = p_role,
      updated_at = now()
  where id = p_user_id
  returning * into v_profile;

  perform public.write_admin_audit(
    'set_user_role',
    'profiles',
    p_user_id::text,
    jsonb_build_object('fromRole', v_old_role, 'toRole', p_role)
  );

  return v_profile;
end;
$$;
