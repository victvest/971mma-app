-- 0174_notification_policy_and_copy.sql
-- Keep phone notifications focused on useful training and academy updates.

-- Referral activity remains visible in the rewards/referrals screens, but it is
-- not important enough to interrupt members with a phone notification.
create or replace function public.notify_member_referral_awarded(
  p_user uuid,
  p_referral_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  return;
end;
$$;

create or replace function public.notify_member_referral_awarded(
  p_user uuid,
  p_referral_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  return;
end;
$$;

-- Attendance copy is short, neutral, and easy to understand.
create or replace function public.roll_call_member_notification_copy(
  p_status text,
  p_class_title text
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_class_title text := coalesce(nullif(trim(p_class_title), ''), 'your class');
begin
  case p_status
    when 'present' then
      return jsonb_build_object(
        'title', 'Attendance confirmed',
        'body', format('You are marked present for %s.', v_class_title)
      );
    when 'late' then
      return jsonb_build_object(
        'title', 'Marked late',
        'body', format('You are marked late for %s.', v_class_title)
      );
    when 'absent' then
      return jsonb_build_object(
        'title', 'Attendance update',
        'body', format('You were marked absent for %s.', v_class_title)
      );
    else
      return null;
  end case;
end;
$$;

-- Keep the settings screen and backend routing categories aligned.
create or replace function public.notification_enabled(p_user uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type ilike '%announcement%' then coalesce(np.announcements, true)
    when p_type ilike '%class%' or p_type ilike '%reminder%' then coalesce(np.class_reminders, true)
    when p_type ilike '%milestone%' or p_type ilike '%promotion%' or p_type ilike '%belt%'
      or p_type ilike '%streak%' or p_type ilike '%progress%' then coalesce(np.milestones, true)
    when p_type ilike '%reward%' or p_type ilike '%redemption%' or p_type ilike '%point%'
      or p_type ilike '%referral%' then coalesce(np.rewards, true)
    when p_type ilike '%guardian%' or p_type ilike '%child%' or p_type ilike '%parent%'
      then coalesce(np.guardian_alerts, true)
    when p_type ilike '%community%' or p_type ilike '%feed%' then coalesce(np.community, true)
    else true
  end
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id
  where p.id = p_user;
$$;

-- Facility entry is intentionally silent in the phone notification center too.
-- Class roll-call and progress notifications remain separate flows.
create or replace function public.notify_guardian_check_in(
  p_trainee_user_id uuid,
  p_check_in_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_class_title text;
  v_checked_in_at timestamptz;
  v_method text;
begin
  select p.full_name, coalesce(c.title, 'class'), ci.checked_in_at, ci.method
    into v_name, v_class_title, v_checked_in_at, v_method
  from public.profiles p
  join public.check_ins ci on ci.user_id = p.id
  left join public.classes c on c.id = ci.class_id
  where p.id = p_trainee_user_id
    and ci.id = p_check_in_id;

  if not found or v_method in ('gate_scan', 'qr_scan') then
    return 0;
  end if;

  return public.notify_guardians_for_trainee(
    p_trainee_user_id,
    'check_in',
    coalesce(v_name, 'Your trainee') || ' checked in',
    'Checked in to ' || coalesce(v_class_title, 'a class') || '.',
    jsonb_build_object(
      'checkInId', p_check_in_id,
      'classTitle', v_class_title,
      'checkedInAt', v_checked_in_at,
      'url', '/family-trainees'
    ),
    'guardian_check_in:' || p_check_in_id::text
  );
end;
$$;
