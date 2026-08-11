-- Migration: 0138_admin_get_users_emails.sql
-- Create database helper to resolve auth.users emails for a list of profile IDs.

create or replace function public.admin_get_users_emails(p_user_ids uuid[])
returns table (id uuid, email text)
language sql
security definer
set search_path = auth, public
as $$
  select u.id, u.email::text
  from auth.users u
  where u.id = any(p_user_ids);
$$;

revoke all on function public.admin_get_users_emails(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_get_users_emails(uuid[]) to service_role;
