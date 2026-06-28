-- Gate Entry QR — Phase 1: gate role, gate_tokens persistence, check_ins audit column.

-- Extend profiles.role to include dedicated entrance-display staff.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('member', 'coach', 'admin', 'gate'));

-- Rotating entrance window tokens (multi-use within TTL; service role writes only).
create table if not exists public.gate_tokens (
  id uuid primary key default gen_random_uuid(),
  jti uuid not null unique,
  location_id text not null,
  expires_at timestamptz not null,
  issued_by_user_id uuid references auth.users(id) on delete set null,
  device_label text,
  created_at timestamptz not null default now()
);

create index if not exists idx_gate_tokens_expires_at
  on public.gate_tokens (expires_at);

create index if not exists idx_gate_tokens_jti
  on public.gate_tokens (jti);

comment on table public.gate_tokens is
  'Entrance display QR window tokens. Issued by gate-qr-issue (Edge); consumed by entry-checkin. Multi-use until expires_at.';

-- Audit which gate window token was presented at facility check-in.
alter table public.check_ins
  add column if not exists gate_jti uuid;

comment on column public.check_ins.gate_jti is
  'gate_tokens.jti used for gate_scan check-ins; null for other methods.';

create index if not exists idx_check_ins_gate_jti
  on public.check_ins (gate_jti)
  where gate_jti is not null;

-- Helpers for future gate-scoped RPCs (Phase 2+).
create or replace function public.is_gate_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('gate', 'admin')
  );
$$;

revoke all on function public.is_gate_or_admin() from public;
grant execute on function public.is_gate_or_admin() to authenticated;

-- No direct client access; Edge Functions use service role.
alter table public.gate_tokens enable row level security;

-- Admin may assign gate role from dashboard RPC.
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

  if p_role is null or p_role not in ('member', 'coach', 'admin', 'gate') then
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
