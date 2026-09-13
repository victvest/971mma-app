-- Migration 0166: Create admin_get_activation_candidates RPC
-- Allows admins to fetch candidate Mindbody profiles from link attempts when multiple profiles match

create or replace function public.admin_get_activation_candidates(p_user_id uuid)
returns table (
  id text,
  unique_id text,
  first_name text,
  last_name text,
  full_name text,
  status text,
  phone text,
  email text,
  photo_url text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Require admin or service role
  if auth.role() <> 'service_role' and not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Unauthorized';
  end if;

  return query
  with latest_attempt as (
    select a.raw_matches
    from public.mindbody_link_attempts a
    where a.user_id = p_user_id
      and jsonb_typeof(a.raw_matches) = 'array'
      and jsonb_array_length(a.raw_matches) > 0
    order by a.created_at desc
    limit 1
  ),
  elements as (
    select distinct on (elem->>'Id')
      elem->>'Id' as cand_id,
      elem->>'UniqueId' as cand_unique_id,
      elem->>'FirstName' as cand_first_name,
      elem->>'LastName' as cand_last_name,
      trim(concat(coalesce(elem->>'FirstName', ''), ' ', coalesce(elem->>'LastName', ''))) as cand_full_name,
      elem->>'Status' as cand_status,
      coalesce(elem->>'MobilePhone', elem->>'HomePhone') as cand_phone,
      elem->>'Email' as cand_email,
      elem->>'PhotoUrl' as cand_photo_url
    from latest_attempt,
    jsonb_array_elements(latest_attempt.raw_matches) as elem
    where elem->>'Id' is not null
  )
  select 
    elements.cand_id as id,
    elements.cand_unique_id as unique_id,
    elements.cand_first_name as first_name,
    elements.cand_last_name as last_name,
    elements.cand_full_name as full_name,
    elements.cand_status as status,
    elements.cand_phone as phone,
    elements.cand_email as email,
    elements.cand_photo_url as photo_url
  from elements
  order by
    case when lower(elements.cand_status) = 'active' then 0 else 1 end,
    elements.cand_full_name;
end;
$$;

grant execute on function public.admin_get_activation_candidates(uuid) to authenticated;
