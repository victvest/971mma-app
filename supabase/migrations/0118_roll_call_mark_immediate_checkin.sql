-- Coach QR / roll-call marks award class attendance points immediately.
--
-- Context: the member-facing promise is "a coach scans your check-in QR and you get
-- your class attendance credit + points + a notification, right away." Until now the
-- redeemable POINTS only landed when the coach *submitted* roll call: record_roll_call_mark
-- (migration 0060) wrote class_session_attendance only, and complete_roll_call
-- (migration 0061, via roll_call_sync_check_ins) created the 'coach_roster' check_ins
-- row that the on_check_in trigger turns into 10 points. That leaves two gaps the product
-- needs closed:
--   1. A late arrival scanned mid/after class got nothing until the coach hit Submit.
--   2. A member scanned *after* the coach already submitted (roll_call_session_for_marks
--      accepts 'completed' sessions) never got points, because the sync had already run.
--
-- Fix: when record_roll_call_mark records a COUNTED class attendance for a linked member
-- (status 'present', or 'late' when late_counts_as_present), it now also inserts the
-- 'coach_roster' check_ins row at mark time. This is the exact row complete_roll_call ->
-- roll_call_sync_check_ins would have created, so:
--   * on_check_in fires now -> 10 class-attendance points now.
--   * roll_call_notify_member (already called below) notifies the member now.
--   * The insert is idempotent on idx_check_ins_coach_roster_class_once
--     (user_id, class_id) where method='coach_roster' (migration 0053), and
--     roll_call_sync_check_ins is itself `not exists`-guarded, so submitting roll call
--     later inserts nothing extra. No double points, no duplicate rows.
--
-- Scope guard: this is CLASS attendance only. It never touches the facility
-- (gate_scan / qr_scan) one-per-day path, the SALTO gate functions, or membership
-- eligibility. "Double points" (facility 971mma entry + class attendance = 20) still
-- comes solely from a member also having a gate/QR facility entry that day, exactly as
-- before. Only linked members (user_id present) earn points; not-on-app / mindbody-only
-- marks are recorded for the roster but earn nothing, unchanged.
--
-- The body below is migration 0060's record_roll_call_mark verbatim, with the single
-- check_ins insert added after roll_call_notify_member. Keeping the rest byte-identical
-- avoids any behavioural drift in auth, upsert, or session resolution.

create or replace function public.record_roll_call_mark(
  p_class_id uuid,
  p_user_id uuid default null,
  p_mindbody_client_id text default null,
  p_status text default null,
  p_method text default 'roll_call',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.roll_call_sessions%rowtype;
  v_user_id uuid := p_user_id;
  v_mindbody_client_id text := nullif(trim(p_mindbody_client_id), '');
  v_status text := nullif(trim(p_status), '');
  v_method text := coalesce(nullif(trim(p_method), ''), 'roll_call');
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_row public.class_session_attendance%rowtype;
  v_late_counts boolean;
  v_counts_as_attendance boolean;
begin
  perform public.require_roll_call_coach_for_class(p_class_id);

  if p_class_id is null then
    raise exception using message = 'BAD_REQUEST', errcode = 'P0001';
  end if;

  if v_user_id is null and v_mindbody_client_id is null then
    raise exception using message = 'MEMBER_REF_REQUIRED', errcode = 'P0001';
  end if;

  if v_status is null or v_status not in ('present', 'absent', 'late', 'left_early', 'guest') then
    raise exception using message = 'INVALID_STATUS', errcode = 'P0001';
  end if;

  if v_method not in ('roll_call', 'walk_in', 'qr_scan', 'roster_list') then
    raise exception using message = 'INVALID_METHOD', errcode = 'P0001';
  end if;

  if not exists (select 1 from public.classes where id = p_class_id) then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select * into v_session
  from public.roll_call_session_for_marks(p_class_id)
  limit 1;

  if not found or v_session.id is null then
    raise exception using message = 'NO_ACTIVE_SESSION', errcode = 'P0001';
  end if;

  if v_user_id is not null and v_mindbody_client_id is null then
    select ml.mindbody_client_id into v_mindbody_client_id
    from public.mindbody_links ml
    where ml.user_id = v_user_id;
  elsif v_user_id is null and v_mindbody_client_id is not null then
    select ml.user_id into v_user_id
    from public.mindbody_links ml
    where ml.mindbody_client_id = v_mindbody_client_id;
  end if;

  if v_user_id is not null then
    insert into public.class_session_attendance (
      class_id,
      user_id,
      mindbody_client_id,
      status,
      method,
      marked_by,
      marked_at,
      roll_call_session_id,
      metadata
    )
    values (
      p_class_id,
      v_user_id,
      v_mindbody_client_id,
      v_status,
      v_method,
      auth.uid(),
      now(),
      v_session.id,
      v_metadata
    )
    on conflict (class_id, user_id) where user_id is not null
    do update set
      status = excluded.status,
      method = excluded.method,
      marked_by = auth.uid(),
      marked_at = now(),
      roll_call_session_id = excluded.roll_call_session_id,
      metadata = coalesce(class_session_attendance.metadata, '{}'::jsonb) || excluded.metadata,
      updated_at = now()
    returning * into v_row;
  else
    insert into public.class_session_attendance (
      class_id,
      user_id,
      mindbody_client_id,
      status,
      method,
      marked_by,
      marked_at,
      roll_call_session_id,
      metadata
    )
    values (
      p_class_id,
      null,
      v_mindbody_client_id,
      v_status,
      v_method,
      auth.uid(),
      now(),
      v_session.id,
      v_metadata
    )
    on conflict (class_id, mindbody_client_id) where mindbody_client_id is not null and user_id is null
    do update set
      status = excluded.status,
      method = excluded.method,
      marked_by = auth.uid(),
      marked_at = now(),
      roll_call_session_id = excluded.roll_call_session_id,
      metadata = coalesce(class_session_attendance.metadata, '{}'::jsonb) || excluded.metadata,
      updated_at = now()
    returning * into v_row;
  end if;

  perform public.roll_call_notify_member(v_user_id, p_class_id, v_status, v_row.marked_at);

  -- Immediate class-attendance credit for linked members. Mirrors the row
  -- roll_call_sync_check_ins creates on completion; same method, same uniqueness guard,
  -- so it is idempotent with both a repeat mark and the submit-time sync.
  if v_user_id is not null then
    select coalesce(late_counts_as_present, true)
      into v_late_counts
    from public.roll_call_settings
    where id = 1;

    v_counts_as_attendance :=
      v_status = 'present'
      or (v_status = 'late' and coalesce(v_late_counts, true));

    if v_counts_as_attendance then
      insert into public.check_ins (
        user_id,
        class_id,
        checked_in_at,
        method,
        source,
        signed_in,
        missed,
        late_cancelled
      )
      values (
        v_user_id,
        p_class_id,
        coalesce(v_row.marked_at, now()),
        'coach_roster',
        'supabase',
        true,
        false,
        false
      )
      on conflict (user_id, class_id) where class_id is not null and method = 'coach_roster'
      do nothing;
    end if;
  end if;

  return jsonb_build_object(
    'mark', public.roll_call_mark_to_json(v_row),
    'session', public.roll_call_session_to_json(v_session)
  );
end;
$$;
