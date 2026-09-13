-- 1. Remove orphaned pending guardian links from legacy July test data so "Needs approval" and badge "2" are cleared
delete from public.guardian_links
where status = 'pending'
  and trainee_user_id is null
  and requested_at < '2026-09-01'::timestamptz;

-- 2. Update admin_list_guardian_links to exclude 'revoked' (removed) links by default
create or replace function public.admin_list_guardian_links(
  p_status text default null,
  p_limit int default 25,
  p_offset int default 0,
  p_query text default null,
  p_order text default 'recent'
)
returns table (
  id uuid,
  guardian_user_id uuid,
  trainee_user_id uuid,
  status text,
  child_display_name text,
  child_date_of_birth date,
  child_email text,
  child_phone text,
  mindbody_client_id text,
  request_notes text,
  requested_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  rejected_reason text,
  account_mode text,
  allow_guardian_qr boolean,
  profiles jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := nullif(lower(trim(coalesce(p_status, ''))), '');
  v_query text := nullif(trim(p_query), '');
  v_order text := lower(coalesce(nullif(trim(p_order), ''), 'recent'));
begin
  perform public.require_admin();

  if v_status is not null and v_status not in ('pending', 'approved', 'rejected', 'revoked') then
    v_status := null;
  end if;

  if v_order not in ('recent', 'oldest', 'active_first') then
    v_order := 'recent';
  end if;

  return query
  select
    gl.id,
    gl.guardian_user_id,
    gl.trainee_user_id,
    gl.status,
    gl.child_display_name,
    gl.child_date_of_birth,
    gl.child_email,
    gl.child_phone,
    gl.mindbody_client_id,
    gl.request_notes,
    gl.requested_at,
    gl.approved_by,
    gl.approved_at,
    gl.rejected_reason,
    gl.account_mode,
    gl.allow_guardian_qr,
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', u.email::text
    ) as profiles
  from public.guardian_links gl
  left join public.profiles p on p.id = gl.guardian_user_id
  left join auth.users u on u.id = gl.guardian_user_id
  where (
      case
        when v_status is not null then gl.status = v_status
        else gl.status != 'revoked'
      end
    )
    and (
      v_query is null
      or gl.id::text = v_query
      or gl.guardian_user_id::text = v_query
      or gl.trainee_user_id::text = v_query
      or gl.child_display_name ilike '%' || v_query || '%'
      or coalesce(gl.child_email, '') ilike '%' || v_query || '%'
      or coalesce(gl.child_phone, '') ilike '%' || v_query || '%'
      or coalesce(gl.mindbody_client_id, '') ilike '%' || v_query || '%'
      or coalesce(p.full_name, '') ilike '%' || v_query || '%'
      or coalesce(u.email::text, '') ilike '%' || v_query || '%'
    )
  order by
    case when v_order = 'active_first' and gl.status = 'approved' then 0 else 1 end,
    case when v_order = 'oldest' then gl.requested_at end asc,
    case when v_order <> 'oldest' then coalesce(gl.approved_at, gl.requested_at) end desc,
    gl.id desc
  limit greatest(least(coalesce(p_limit, 25), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_list_guardian_links(text, int, int, text, text) from public, anon;
grant execute on function public.admin_list_guardian_links(text, int, int, text, text) to authenticated;
