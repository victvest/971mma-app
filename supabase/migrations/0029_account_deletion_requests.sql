-- Account deletion requests — members submit; staff process offline via admin tools.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  notes text
);

create unique index if not exists idx_account_deletion_requests_pending_user
  on public.account_deletion_requests (user_id)
  where status = 'pending';

create index if not exists idx_account_deletion_requests_requested
  on public.account_deletion_requests (requested_at desc);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "account_deletion_requests select own" on public.account_deletion_requests;
create policy "account_deletion_requests select own"
  on public.account_deletion_requests for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "account_deletion_requests select admin" on public.account_deletion_requests;
create policy "account_deletion_requests select admin"
  on public.account_deletion_requests for select
  to authenticated
  using (public.is_admin());

-- Inserts/updates only via security-definer RPC (no direct member writes).

create or replace function public.request_account_deletion()
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.account_deletion_requests;
  v_row public.account_deletion_requests;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_existing
  from public.account_deletion_requests
  where user_id = auth.uid()
    and status = 'pending'
  limit 1;

  if found then
    return v_existing;
  end if;

  insert into public.account_deletion_requests (user_id)
  values (auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;
