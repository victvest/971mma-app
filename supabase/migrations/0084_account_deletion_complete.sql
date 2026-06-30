-- Account deletion completion: preserve request history, unblock auth deletion, guard RPC.

alter table public.account_deletion_requests
  add column if not exists member_display_name text,
  add column if not exists auth_deleted_at timestamptz;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_user_id_fkey;

alter table public.account_deletion_requests
  alter column user_id drop not null;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- Allow historical roll call / moderation rows to survive coach/moderator deletion.
alter table public.community_moderation_actions
  alter column performed_by drop not null;

alter table public.community_moderation_actions
  drop constraint if exists community_moderation_actions_performed_by_fkey;

alter table public.community_moderation_actions
  add constraint community_moderation_actions_performed_by_fkey
  foreign key (performed_by) references public.profiles(id) on delete set null;

alter table public.roll_call_sessions
  alter column coach_id drop not null;

alter table public.roll_call_sessions
  drop constraint if exists roll_call_sessions_coach_id_fkey;

alter table public.roll_call_sessions
  add constraint roll_call_sessions_coach_id_fkey
  foreign key (coach_id) references auth.users(id) on delete set null;

alter table public.class_session_attendance
  alter column marked_by drop not null;

alter table public.class_session_attendance
  drop constraint if exists class_session_attendance_marked_by_fkey;

alter table public.class_session_attendance
  add constraint class_session_attendance_marked_by_fkey
  foreign key (marked_by) references auth.users(id) on delete set null;

create or replace function public.prepare_auth_user_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  update public.community_moderation_actions
  set performed_by = null
  where performed_by = p_user_id;

  update public.roll_call_sessions
  set coach_id = null
  where coach_id = p_user_id;

  update public.class_session_attendance
  set marked_by = null
  where marked_by = p_user_id;
end;
$$;

revoke all on function public.prepare_auth_user_deletion(uuid) from public;
grant execute on function public.prepare_auth_user_deletion(uuid) to service_role;

create or replace function public.request_account_deletion()
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.account_deletion_requests;
  v_row public.account_deletion_requests;
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select full_name
  into v_display_name
  from public.profiles
  where id = auth.uid();

  select *
  into v_existing
  from public.account_deletion_requests
  where user_id = auth.uid()
    and status = 'pending'
  limit 1;

  if found then
    if v_existing.member_display_name is null and v_display_name is not null then
      update public.account_deletion_requests
      set member_display_name = v_display_name
      where id = v_existing.id
      returning * into v_existing;
    end if;

    return v_existing;
  end if;

  insert into public.account_deletion_requests (user_id, member_display_name)
  values (auth.uid(), v_display_name)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_update_account_deletion_request(
  p_id uuid,
  p_status text,
  p_notes text default null
)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_row public.account_deletion_requests;
begin
  perform public.require_admin();

  v_status := coalesce(nullif(trim(p_status), ''), 'pending');
  if v_status not in ('pending', 'processing', 'completed', 'cancelled') then
    raise exception using message = 'INVALID_STATUS', errcode = 'P0001';
  end if;

  if v_status = 'completed' then
    raise exception using message = 'USE_ACCOUNT_DELETE_ENDPOINT', errcode = 'P0001';
  end if;

  update public.account_deletion_requests
  set
    status = v_status,
    notes = coalesce(nullif(trim(p_notes), ''), notes),
    processed_at = case
      when v_status = 'cancelled' then coalesce(processed_at, now())
      else processed_at
    end
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.write_admin_audit(
    'update_account_deletion_request',
    'account_deletion_requests',
    p_id::text,
    jsonb_build_object('status', v_status)
  );

  return v_row;
end;
$$;
