-- Gate exit PIN — admin-managed, bcrypt-hashed at rest. Tablets validate via RPC (not env).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.gate_settings (
  id int primary key default 1 check (id = 1),
  exit_pin_hash text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.gate_settings (id)
values (1)
on conflict (id) do nothing;

comment on table public.gate_settings is
  'Singleton academy gate display settings. Exit PIN hash only — never store plaintext.';

alter table public.gate_settings enable row level security;

create or replace function public.admin_get_gate_settings()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.gate_settings%rowtype;
begin
  perform public.require_admin();

  select *
    into v_row
  from public.gate_settings
  where id = 1;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'exitPinConfigured', v_row.exit_pin_hash is not null,
    'updatedAt', v_row.updated_at,
    'updatedBy', v_row.updated_by
  );
end;
$$;

create or replace function public.admin_update_gate_exit_pin(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_trimmed text;
begin
  perform public.require_admin();

  v_trimmed := trim(coalesce(p_pin, ''));
  if v_trimmed !~ '^\d{4}$' then
    raise exception using message = 'INVALID_PIN', errcode = 'P0001';
  end if;

  update public.gate_settings
  set exit_pin_hash = crypt(v_trimmed, gen_salt('bf')),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

  perform public.write_admin_audit(
    'update_gate_exit_pin',
    'gate_settings',
    '1',
    jsonb_build_object('exitPinConfigured', true)
  );

  return public.admin_get_gate_settings();
end;
$$;

create or replace function public.gate_exit_pin_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.gate_settings%rowtype;
begin
  if not public.is_gate_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  select *
    into v_row
  from public.gate_settings
  where id = 1;

  return jsonb_build_object(
    'exitPinConfigured', v_row.exit_pin_hash is not null,
    'updatedAt', v_row.updated_at
  );
end;
$$;

create or replace function public.gate_validate_exit_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_trimmed text;
begin
  if not public.is_gate_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  v_trimmed := trim(coalesce(p_pin, ''));
  if v_trimmed !~ '^\d{4}$' then
    return false;
  end if;

  select exit_pin_hash
    into v_hash
  from public.gate_settings
  where id = 1;

  if v_hash is null then
    return false;
  end if;

  return crypt(v_trimmed, v_hash) = v_hash;
end;
$$;

revoke all on function public.admin_get_gate_settings() from public;
revoke all on function public.admin_update_gate_exit_pin(text) from public;
revoke all on function public.gate_exit_pin_status() from public;
revoke all on function public.gate_validate_exit_pin(text) from public;

grant execute on function public.admin_get_gate_settings() to authenticated;
grant execute on function public.admin_update_gate_exit_pin(text) to authenticated;
grant execute on function public.gate_exit_pin_status() to authenticated;
grant execute on function public.gate_validate_exit_pin(text) to authenticated;
