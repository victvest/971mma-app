-- Admin members directory: resolve app signup emails (auth.users) when
-- Mindbody client email differs (phone match / manual activation link).

create or replace function public.find_user_ids_by_email_pattern(
  p_query text,
  p_limit int default 50
)
returns table (id uuid)
language sql
stable
security definer
set search_path = auth, public
as $$
  select u.id
  from auth.users u
  where nullif(trim(coalesce(p_query, '')), '') is not null
    and u.email ilike '%' || trim(p_query) || '%'
  order by u.email
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.find_user_ids_by_email_pattern(text, int) from public, anon, authenticated;
grant execute on function public.find_user_ids_by_email_pattern(text, int) to service_role;
