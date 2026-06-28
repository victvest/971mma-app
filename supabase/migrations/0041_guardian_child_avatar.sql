-- Store trainee avatar on guardian link requests; applied to profile on approval.

alter table public.guardian_links
  add column if not exists child_avatar_url text;

comment on column public.guardian_links.child_avatar_url is
  'Avatar uploaded by guardian when requesting a link; copied to trainee profile on approval.';

drop function if exists public.request_child_link(text, date, text, text, text, text, text);

create or replace function public.request_child_link(
  p_child_name text,
  p_date_of_birth date default null,
  p_email text default null,
  p_phone text default null,
  p_mindbody_client_id text default null,
  p_notes text default null,
  p_account_mode text default 'managed',
  p_child_avatar_url text default null
)
returns public.guardian_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(p_child_name), '');
  v_mode text := lower(nullif(trim(coalesce(p_account_mode, '')), ''));
  v_avatar text := nullif(trim(coalesce(p_child_avatar_url, '')), '');
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
    allow_guardian_qr,
    child_avatar_url
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
    case when v_mode = 'managed' then true else false end,
    v_avatar
  )
  returning * into v_link;

  return v_link;
end;
$$;

revoke all on function public.request_child_link(text, date, text, text, text, text, text, text) from public;
grant execute on function public.request_child_link(text, date, text, text, text, text, text, text) to authenticated;
