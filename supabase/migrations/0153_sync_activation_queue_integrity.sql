-- Two-way synchronization between member activation status and activation queue:
-- 1. If an active / linked member has an activation request, it MUST be 'resolved'.
-- 2. If an unlinked / activation_required member has an activation request, it MUST be 'pending' (Needs action).
-- 3. If a member is unlinked or set to activation_required, ensure a pending activation request exists so admins can find them in the queue.

-- Step 1: Fix data where unlinked/inactive members were incorrectly marked 'resolved'
update public.activation_requests ar
set status = 'pending',
    resolved_at = null
from public.profiles p
where ar.user_id = p.id
  and coalesce(p.account_status, 'activation_required') != 'active'
  and not exists (
    select 1 from public.mindbody_links ml
    where ml.user_id = ar.user_id
      and nullif(trim(ml.mindbody_client_id), '') is not null
  );

-- Step 2: Fix data where active/linked members were still marked 'pending'
update public.activation_requests ar
set status = 'resolved',
    resolved_at = coalesce(ar.resolved_at, now())
from public.profiles p
where ar.user_id = p.id
  and ar.status = 'pending'
  and (
    p.account_status = 'active'
    or exists (
      select 1 from public.mindbody_links ml
      where ml.user_id = ar.user_id
        and nullif(trim(ml.mindbody_client_id), '') is not null
    )
  );

-- Step 3: Trigger on profiles to maintain 2-way sync
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
      insert into public.activation_requests (user_id, status, requested_at)
      values (new.id, 'pending', now())
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

-- Step 4: Trigger on mindbody_links deletion
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
    insert into public.activation_requests (user_id, status, requested_at)
    values (old.user_id, 'pending', now())
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
