-- Support / contact messages — members submit from the Help screen; admins triage in the console.

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'general'
    check (category in ('general', 'membership', 'billing', 'technical', 'classes', 'feedback')),
  subject text not null,
  message text not null,
  contact_email text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_support_messages_user
  on public.support_messages (user_id, created_at desc);

create index if not exists idx_support_messages_status
  on public.support_messages (status, created_at desc);

alter table public.support_messages enable row level security;

-- Members read only their own messages; admins read all.
drop policy if exists "support_messages select own" on public.support_messages;
create policy "support_messages select own"
  on public.support_messages for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "support_messages select admin" on public.support_messages;
create policy "support_messages select admin"
  on public.support_messages for select
  to authenticated
  using (public.is_admin());

-- No direct member writes — inserts go through the security-definer RPC below,
-- and status changes go through the admin RPC.

-- ── Member submit ─────────────────────────────────────────────────────────────
create or replace function public.submit_support_message(
  p_category text,
  p_subject text,
  p_message text
)
returns public.support_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
  v_subject text;
  v_message text;
  v_email text;
  v_open_count int;
  v_row public.support_messages;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  v_category := coalesce(nullif(trim(p_category), ''), 'general');
  if v_category not in ('general', 'membership', 'billing', 'technical', 'classes', 'feedback') then
    v_category := 'general';
  end if;

  v_subject := nullif(trim(p_subject), '');
  v_message := nullif(trim(p_message), '');

  if v_subject is null then
    raise exception using message = 'SUBJECT_REQUIRED', errcode = 'P0001';
  end if;

  if v_message is null then
    raise exception using message = 'MESSAGE_REQUIRED', errcode = 'P0001';
  end if;

  if length(v_subject) > 120 then
    v_subject := left(v_subject, 120);
  end if;

  if length(v_message) > 2000 then
    raise exception using message = 'MESSAGE_TOO_LONG', errcode = 'P0001';
  end if;

  -- Light abuse guard: cap concurrently open tickets per member.
  select count(*) into v_open_count
  from public.support_messages
  where user_id = auth.uid()
    and status in ('open', 'in_progress');

  if v_open_count >= 10 then
    raise exception using message = 'TOO_MANY_OPEN_MESSAGES', errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.support_messages (user_id, category, subject, message, contact_email)
  values (auth.uid(), v_category, v_subject, v_message, v_email)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_support_message(text, text, text) from public;
grant execute on function public.submit_support_message(text, text, text) to authenticated;

-- ── Admin update (status + notes), audited ────────────────────────────────────
create or replace function public.admin_update_support_message(
  p_id uuid,
  p_status text,
  p_admin_notes text default null
)
returns public.support_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_row public.support_messages;
begin
  perform public.require_admin();

  v_status := coalesce(nullif(trim(p_status), ''), 'open');
  if v_status not in ('open', 'in_progress', 'resolved', 'closed') then
    raise exception using message = 'INVALID_STATUS', errcode = 'P0001';
  end if;

  update public.support_messages
  set
    status = v_status,
    admin_notes = coalesce(nullif(trim(p_admin_notes), ''), admin_notes),
    resolved_at = case
      when v_status in ('resolved', 'closed') then coalesce(resolved_at, now())
      else null
    end,
    updated_at = now()
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  perform public.write_admin_audit(
    'update_support_message',
    'support_messages',
    p_id::text,
    jsonb_build_object('status', v_status)
  );

  return v_row;
end;
$$;

revoke all on function public.admin_update_support_message(uuid, text, text) from public;
grant execute on function public.admin_update_support_message(uuid, text, text) to authenticated;
