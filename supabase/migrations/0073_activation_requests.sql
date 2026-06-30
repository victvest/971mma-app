-- Member-initiated activation help requests — one per account; staff triages offline.

create table if not exists public.activation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'cancelled')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists idx_activation_requests_user
  on public.activation_requests (user_id);

create index if not exists idx_activation_requests_pending
  on public.activation_requests (status, requested_at desc)
  where status = 'pending';

alter table public.activation_requests enable row level security;

drop policy if exists "activation_requests select own" on public.activation_requests;
create policy "activation_requests select own"
  on public.activation_requests for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "activation_requests select admin" on public.activation_requests;
create policy "activation_requests select admin"
  on public.activation_requests for select
  to authenticated
  using (public.is_admin());

create or replace function public.request_account_activation()
returns public.activation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_existing public.activation_requests;
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

  select *
  into v_existing
  from public.activation_requests
  where user_id = auth.uid()
  limit 1;

  if found then
    return v_existing;
  end if;

  insert into public.activation_requests (user_id)
  values (auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.request_account_activation() from public;
grant execute on function public.request_account_activation() to authenticated;
