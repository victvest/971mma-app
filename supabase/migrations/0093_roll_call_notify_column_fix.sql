-- Fix roll_call_notify_member: 0054 referenced non-existent notify_member_present columns.
-- Actual columns from 0039: notify_member_on_present, notify_member_on_absent.

create or replace function public.roll_call_notify_member(
  p_user_id uuid,
  p_class_id uuid,
  p_status text,
  p_marked_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notify_present boolean;
  v_notify_absent boolean;
  v_class_title text;
  v_copy jsonb;
begin
  if p_user_id is null or p_class_id is null or p_status is null then
    return;
  end if;

  if not coalesce(public.notification_enabled(p_user_id, 'class_attendance'), true) then
    return;
  end if;

  select notify_member_on_present, notify_member_on_absent
    into v_notify_present, v_notify_absent
  from public.roll_call_settings
  where id = 1;

  if p_status in ('present', 'late') and not coalesce(v_notify_present, true) then
    return;
  end if;

  if p_status = 'absent' and not coalesce(v_notify_absent, false) then
    return;
  end if;

  select c.title into v_class_title
  from public.classes c
  where c.id = p_class_id;

  if not found then
    return;
  end if;

  v_copy := public.roll_call_member_notification_copy(p_status, v_class_title);
  if v_copy is null then
    return;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    p_user_id,
    'class_attendance',
    jsonb_build_object(
      'title', v_copy->>'title',
      'body', v_copy->>'body',
      'classId', p_class_id,
      'status', p_status,
      'markedAt', p_marked_at
    )
  );
end;
$$;
