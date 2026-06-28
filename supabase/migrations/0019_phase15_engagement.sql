-- Phase 15: announcement creation with notification fan-out and read helpers.

create or replace function public.create_announcement(
  p_channel text,
  p_title text,
  p_body text
)
returns public.announcements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel text := nullif(trim(p_channel), '');
  v_title text := nullif(trim(p_title), '');
  v_body text := nullif(trim(p_body), '');
  v_row public.announcements%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  if not public.is_coach_or_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if v_title is null or v_body is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  insert into public.announcements (author_id, channel, title, body)
  values (auth.uid(), coalesce(v_channel, 'general'), v_title, v_body)
  returning * into v_row;

  insert into public.notifications (user_id, type, payload)
  select
    p.id,
    'announcement',
    jsonb_build_object(
      'announcementId', v_row.id,
      'channel', v_row.channel,
      'title', v_row.title,
      'body', v_row.body
    )
  from public.profiles p
  where p.id <> auth.uid();

  return v_row;
end;
$$;

create or replace function public.mark_notification_read(p_notification uuid)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.notifications%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification
    and user_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHORIZED', errcode = 'P0001';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where user_id = auth.uid()
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.create_announcement(text, text, text) from public, anon;
grant execute on function public.create_announcement(text, text, text) to authenticated;

revoke execute on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;
