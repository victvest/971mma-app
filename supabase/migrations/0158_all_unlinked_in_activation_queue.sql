-- 0158_all_unlinked_in_activation_queue.sql
-- Show all unlinked members in the Activation Queue, prioritizing those who tapped "Request activation".

-- 1. Add requested_by_user column to activation_requests (default true for existing records)
alter table public.activation_requests
  add column if not exists requested_by_user boolean not null default true;

-- 2. Insert all unlinked profiles that don't yet have an activation request
insert into public.activation_requests (user_id, status, requested_by_user, requested_at)
select
  p.id,
  'pending',
  false,
  coalesce(p.created_at, now())
from public.profiles p
where coalesce(p.account_status, 'activation_required') != 'active'
  and not exists (
    select 1 from public.mindbody_links ml
    where ml.user_id = p.id
      and nullif(trim(ml.mindbody_client_id), '') is not null
  )
  and not exists (
    select 1 from public.activation_requests ar
    where ar.user_id = p.id
  );

-- 3. Update request_account_activation RPC so tapping the button in the app sets requested_by_user = true
create or replace function public.request_account_activation()
returns public.activation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_row public.activation_requests;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  select account_status
  into v_status
  from public.profiles
  where id = auth.uid();

  if v_status is null then
    raise exception using message = 'PROFILE_NOT_FOUND', errcode = 'P0001';
  end if;

  if v_status = 'active' then
    raise exception using message = 'ALREADY_ACTIVE', errcode = 'P0001';
  end if;

  insert into public.activation_requests (user_id, status, requested_by_user, requested_at)
  values (auth.uid(), 'pending', true, now())
  on conflict (user_id) do update
  set requested_by_user = true,
      status = 'pending',
      requested_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.request_account_activation() from public;
grant execute on function public.request_account_activation() to authenticated;

-- 4. Triggers to maintain sync on profile and mindbody_links updates
create or replace function public.trig_sync_activation_request_on_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_status = 'active' then
    update public.activation_requests
    set status = 'resolved',
        resolved_at = coalesce(resolved_at, now())
    where user_id = new.id
      and status = 'pending';
  elsif new.account_status = 'activation_required' then
    if exists (select 1 from public.activation_requests where user_id = new.id) then
      update public.activation_requests
      set status = 'pending',
          resolved_at = null
      where user_id = new.id
        and status != 'pending';
    else
      insert into public.activation_requests (user_id, status, requested_by_user, requested_at)
      values (new.id, 'pending', false, now())
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_profiles_sync_activation on public.profiles;
create trigger tr_profiles_sync_activation
after insert or update of account_status on public.profiles
for each row
execute function public.trig_sync_activation_request_on_profile();

create or replace function public.trig_auto_reopen_activation_on_unlink()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.activation_requests where user_id = old.user_id) then
    update public.activation_requests
    set status = 'pending',
        resolved_at = null
    where user_id = old.user_id;
  else
    insert into public.activation_requests (user_id, status, requested_by_user, requested_at)
    values (old.user_id, 'pending', false, now())
    on conflict do nothing;
  end if;
  return old;
end;
$$;

drop trigger if exists tr_mindbody_links_reopen_activation on public.mindbody_links;
create trigger tr_mindbody_links_reopen_activation
after delete on public.mindbody_links
for each row
execute function public.trig_auto_reopen_activation_on_unlink();

-- 5. Drop and recreate admin_list_activation_requests with requested_by_user and priority sorting
drop function if exists public.admin_list_activation_requests(text, int, int, text, text);
create or replace function public.admin_list_activation_requests(
  p_status text default null,
  p_limit int default 20,
  p_offset int default 0,
  p_query text default null,
  p_order text default 'newest'
)
returns table (
  id uuid,
  user_id uuid,
  status text,
  requested_at timestamptz,
  resolved_at timestamptz,
  full_name text,
  email text,
  phone text,
  account_status text,
  mindbody_client_id text,
  requested_by_user boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_status text := nullif(trim(p_status), '');
  v_query text := nullif(trim(p_query), '');
  v_order text := lower(coalesce(nullif(trim(p_order), ''), 'newest'));
begin
  perform public.require_admin();

  if v_order not in ('newest', 'oldest', 'linked_first') then
    v_order := 'newest';
  end if;

  return query
  select
    ar.id,
    ar.user_id,
    ar.status,
    ar.requested_at,
    ar.resolved_at,
    p.full_name,
    u.email::text,
    coalesce(nullif(trim(p.phone), ''), nullif(trim(u.phone), '')) as phone,
    p.account_status,
    ml.mindbody_client_id,
    coalesce(ar.requested_by_user, false) as requested_by_user
  from public.activation_requests ar
  join public.profiles p on p.id = ar.user_id
  join auth.users u on u.id = ar.user_id
  left join public.mindbody_links ml on ml.user_id = ar.user_id
  where (
      case
        when v_status = 'pending' then
          ar.status = 'pending'
          and coalesce(p.account_status, 'activation_required') != 'active'
          and ml.mindbody_client_id is null
        when v_status is not null then
          ar.status = v_status
        else true
      end
    )
    and (
      v_query is null
      or p.full_name ilike '%' || v_query || '%'
      or u.email::text ilike '%' || v_query || '%'
      or p.phone ilike '%' || v_query || '%'
      or u.phone ilike '%' || v_query || '%'
      or ml.mindbody_client_id ilike '%' || v_query || '%'
      or ar.user_id::text = v_query
    )
  order by
    case when v_status is null and ar.status = 'pending' then 0 else 1 end,
    -- PRIORITY: Those who tapped the button in the app appear at the top first!
    case when ar.status = 'pending' and coalesce(ar.requested_by_user, false) then 0 else 1 end asc,
    case
      when v_order = 'linked_first' and ml.mindbody_client_id is not null then 0
      when v_order = 'linked_first' then 1
      else 0
    end,
    case when v_order = 'oldest' then ar.requested_at end asc,
    case when v_order in ('newest', 'linked_first') then ar.requested_at end desc,
    ar.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_activation_requests(text, int, int, text, text) from public;
grant execute on function public.admin_list_activation_requests(text, int, int, text, text) to authenticated;
