-- Indexed auth email lookup for auth-sign-in (replaces O(N) listUsers scan).
-- Member attendance percentile for profile consistency rank.

create or replace function public.get_auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.get_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_auth_user_id_by_email(text) to service_role;

-- Returns the member's top-percent rank (e.g. 5 => "Top 5%") based on counted training days
-- versus all active members (role = member). Null when sample size is too small.
create or replace function public.get_member_percentile_rank(p_user_id uuid default auth.uid())
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_days int;
  v_total int;
  v_below int;
  v_top int;
begin
  if p_user_id is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'member'
  ) then
    return null;
  end if;

  v_user_days := public.count_training_days(p_user_id);

  select
    count(*)::int,
    count(*) filter (where public.count_training_days(p.id) < v_user_days)::int
  into v_total, v_below
  from public.profiles p
  where p.role = 'member';

  if v_total < 2 then
    return null;
  end if;

  v_top := ceil((1 - v_below::numeric / v_total) * 100)::int;
  return greatest(1, least(99, v_top));
end;
$$;

revoke all on function public.get_member_percentile_rank(uuid) from public, anon;
grant execute on function public.get_member_percentile_rank(uuid) to authenticated;
