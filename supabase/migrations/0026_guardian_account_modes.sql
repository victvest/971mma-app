-- Guardian account modes: managed (parent QR) vs independent (child own login).
-- Fraud: rate-limit requests, trainee can read own links, QR audit trail.

alter table public.guardian_links
  add column if not exists account_mode text not null default 'managed'
    check (account_mode in ('managed', 'independent'));

alter table public.guardian_links
  add column if not exists allow_guardian_qr boolean not null default true;

comment on column public.guardian_links.account_mode is
  'managed = no app login, parent shows QR; independent = child has own account';
comment on column public.guardian_links.allow_guardian_qr is
  'When independent: parent may show child QR on their phone. Always true for managed.';

-- Independent trainees default to own-device check-in unless admin enables guardian QR.
alter table public.guardian_links
  alter column allow_guardian_qr set default false;

update public.guardian_links
set allow_guardian_qr = true
where account_mode = 'managed';

alter table public.qr_tokens
  add column if not exists issued_by_user_id uuid references auth.users(id) on delete set null;

comment on column public.qr_tokens.issued_by_user_id is
  'Guardian (or admin) who requested this QR when acting for another member.';

-- Trainees can see who manages them; guardians still see their requests.
drop policy if exists "guardian_links select own" on public.guardian_links;
create policy "guardian_links select own" on public.guardian_links
  for select to authenticated using (
    auth.uid() = guardian_user_id
    or auth.uid() = trainee_user_id
    or public.is_admin()
  );

-- Replace request_child_link with account_mode parameter.
drop function if exists public.request_child_link(text, date, text, text, text, text);

create or replace function public.request_child_link(
  p_child_name text,
  p_date_of_birth date default null,
  p_email text default null,
  p_phone text default null,
  p_mindbody_client_id text default null,
  p_notes text default null,
  p_account_mode text default 'managed'
)
returns public.guardian_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(p_child_name), '');
  v_mode text := lower(nullif(trim(coalesce(p_account_mode, '')), ''));
  v_pending int;
  v_link public.guardian_links;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if v_name is null then
    raise exception 'Child name is required';
  end if;

  if v_mode is null or v_mode not in ('managed', 'independent') then
    raise exception 'Invalid account mode';
  end if;

  select count(*)::int into v_pending
  from public.guardian_links
  where guardian_user_id = auth.uid()
    and status = 'pending';

  if v_pending >= 5 then
    raise exception 'Too many pending child link requests. Contact the front desk.';
  end if;

  insert into public.guardian_links (
    guardian_user_id,
    status,
    child_display_name,
    child_date_of_birth,
    child_email,
    child_phone,
    mindbody_client_id,
    request_notes,
    account_mode,
    allow_guardian_qr
  )
  values (
    auth.uid(),
    'pending',
    v_name,
    p_date_of_birth,
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_mindbody_client_id, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_mode,
    case when v_mode = 'managed' then true else false end
  )
  returning * into v_link;

  return v_link;
end;
$$;

revoke all on function public.request_child_link(text, date, text, text, text, text, text) from public;
grant execute on function public.request_child_link(text, date, text, text, text, text, text) to authenticated;

-- Trainee reads approved guardians (guardian profile name only — no email leak).
create or replace function public.get_my_guardians()
returns table (
  link_id uuid,
  guardian_user_id uuid,
  guardian_name text,
  account_mode text,
  allow_guardian_qr boolean,
  approved_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    gl.id,
    gl.guardian_user_id,
    coalesce(nullif(trim(p.full_name), ''), 'Guardian'),
    gl.account_mode,
    gl.allow_guardian_qr,
    gl.approved_at
  from public.guardian_links gl
  left join public.profiles p on p.id = gl.guardian_user_id
  where gl.trainee_user_id = auth.uid()
    and gl.status = 'approved';
$$;

revoke all on function public.get_my_guardians() from public;
grant execute on function public.get_my_guardians() to authenticated;
